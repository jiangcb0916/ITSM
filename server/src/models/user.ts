import { pool, query, queryOne } from '../db';
import { User, UserRole, UserStatus } from '../types';

const userColumns = 'id, email, name, role, status, created_at, updated_at, last_login_at';

const notDeleted = '(deleted_at IS NULL)';

export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT id, email, password_hash, name, role, status, created_at, updated_at, last_login_at FROM users WHERE email = $1 AND ${notDeleted}`,
    [email]
  );
  return row as (User & { password_hash: string }) | null;
}

export async function findUserById(id: number): Promise<User | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT ${userColumns} FROM users WHERE id = $1 AND ${notDeleted}`,
    [id]
  );
  return row as User | null;
}

export async function createUser(
  email: string,
  passwordHash: string,
  name: string,
  role: UserRole = 'user'
): Promise<User> {
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${userColumns}`,
    [email, passwordHash, name, role]
  );
  if (!row) throw new Error('Create user failed');
  return row as unknown as User;
}

export async function listTechnicians(): Promise<User[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${userColumns} FROM users WHERE ${notDeleted} AND role IN ('technician', 'admin') AND (status = 'active' OR status IS NULL) ORDER BY name`
  );
  return rows as unknown as User[];
}

/** 仅返回角色为 technician 且状态为 active 的用户（用于创建工单时指派下拉框，对应需求中的 role='tech'） */
export async function listTechs(): Promise<Pick<User, 'id' | 'name' | 'email'>[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT id, name, email FROM users WHERE ${notDeleted} AND role = 'technician' AND (status = 'active' OR status IS NULL) ORDER BY name`
  );
  return rows as unknown as Pick<User, 'id' | 'name' | 'email'>[];
}

export interface ListUsersOptions {
  limit: number;
  offset: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface ListUsersResult {
  users: User[];
  total: number;
}

export async function listUsers(opts: ListUsersOptions): Promise<ListUsersResult> {
  const { limit, offset, search, role, status } = opts;
  const conditions: string[] = [notDeleted];
  const params: unknown[] = [];
  let idx = 1;
  if (search) {
    conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (role) {
    conditions.push(`role = $${idx}`);
    params.push(role);
    idx++;
  }
  if (status) {
    conditions.push(`(status = $${idx} OR (status IS NULL AND $${idx}::text = 'active'))`);
    params.push(status);
    idx++;
  }
  const where = conditions.join(' AND ');
  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users WHERE ${where}`,
    params
  );
  const total = countRow ? parseInt(countRow.count, 10) : 0;
  params.push(limit, offset);
  const rows = await query<Record<string, unknown>>(
    `SELECT ${userColumns} FROM users WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );
  return { users: (rows || []) as unknown as User[], total };
}

export async function updateLastLoginAt(id: number): Promise<void> {
  await query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
    [id]
  );
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
}

export async function updateUser(id: number, data: UpdateUserData): Promise<User | null> {
  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (data.email !== undefined) {
    updates.push(`email = $${idx++}`);
    params.push(data.email);
  }
  if (data.name !== undefined) {
    updates.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.role !== undefined) {
    updates.push(`role = $${idx++}`);
    params.push(data.role);
  }
  if (data.status !== undefined) {
    updates.push(`status = $${idx++}`);
    params.push(data.status);
  }
  if (data.password !== undefined) {
    updates.push(`password_hash = $${idx++}`);
    params.push(data.password);
  }
  if (updates.length === 0) return findUserById(id);
  params.push(id);
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} AND ${notDeleted} RETURNING ${userColumns}`,
    params
  );
  return row as User | null;
}

/** 未删除的管理员数量 */
export async function countAdmins(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users WHERE ${notDeleted} AND role = 'admin'`,
    []
  );
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * 软删除用户：设置 deleted_at、status=disabled，并处理其作为指派的工单（转移或置空）
 */
export async function softDeleteUser(userId: number, transferUserId: number | null): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE users SET deleted_at = CURRENT_TIMESTAMP, status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [userId]
    );
    if (transferUserId != null) {
      await client.query('UPDATE tickets SET assignee_id = $1 WHERE assignee_id = $2', [transferUserId, userId]);
    } else {
      await client.query('UPDATE tickets SET assignee_id = NULL WHERE assignee_id = $1', [userId]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
