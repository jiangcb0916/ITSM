import { query, queryOne } from '../db';
import { Ticket, TicketCategory, TicketPriority, TicketStatus } from '../types';

export interface TicketWithCreator extends Ticket {
  creator_name?: string;
  assignee_name?: string;
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignee_id?: number;
  creator_id?: number;
  search?: string;
  /** 为 true 时仅返回 deleted_by_user = false 的工单（用于普通用户列表） */
  exclude_deleted_by_user?: boolean;
}

export async function createTicket(
  title: string,
  description: string,
  creatorId: number,
  category: TicketCategory = 'other',
  priority: TicketPriority = 'medium',
  assigneeId?: number | null
): Promise<Ticket> {
  const hasAssignee = assigneeId != null && assigneeId > 0;
  const row = await queryOne<Record<string, unknown>>(
    hasAssignee
      ? `INSERT INTO tickets (title, description, category, priority, creator_id, assignee_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`
      : `INSERT INTO tickets (title, description, category, priority, creator_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
    hasAssignee ? [title, description, category, priority, creatorId, assigneeId] : [title, description, category, priority, creatorId]
  );
  if (!row) throw new Error('Create ticket failed');
  return row as unknown as Ticket;
}

export async function findTicketById(id: number): Promise<Ticket | null> {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM tickets WHERE id = $1', [id]);
  return row as unknown as Ticket | null;
}

export async function updateTicketStatus(
  id: number,
  status: TicketStatus,
  assigneeId?: number | null
): Promise<Ticket | null> {
  const updates: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
  const values: unknown[] = [id, status];
  let idx = 3;
  if (assigneeId !== undefined) {
    updates.push(`assignee_id = $${idx}`);
    values.push(assigneeId);
    idx++;
  }
  if (status === 'in_progress') {
    updates.push("first_response_at = COALESCE(first_response_at, CURRENT_TIMESTAMP)");
  }
  if (status === 'completed' || status === 'closed') {
    updates.push('completed_at = CURRENT_TIMESTAMP');
  }
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE tickets SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return row as unknown as Ticket | null;
}

export async function assignTicket(ticketId: number, assigneeId: number | null): Promise<Ticket | null> {
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE tickets SET assignee_id = $2, updated_at = CURRENT_TIMESTAMP,
      first_response_at = COALESCE(first_response_at, CURRENT_TIMESTAMP)
     WHERE id = $1 RETURNING *`,
    [ticketId, assigneeId]
  );
  return row as unknown as Ticket | null;
}

/**
 * 自动分配策略：返回当前未完成工单数最少的技术员 ID。
 * 未完成指 status NOT IN ('completed', 'closed')。
 * 若无技术员或查询失败返回 null。
 */
export async function getTechIdForAutoAssign(): Promise<number | null> {
  const rows = await query<{ id: string; cnt: string }>(
    `SELECT u.id::text AS id, COUNT(t.id)::text AS cnt
     FROM users u
     LEFT JOIN tickets t ON t.assignee_id = u.id AND t.status NOT IN ('completed', 'closed')
     WHERE u.deleted_at IS NULL AND u.role = 'technician' AND (u.status = 'active' OR u.status IS NULL)
     GROUP BY u.id
     ORDER BY COUNT(t.id) ASC, u.id ASC
     LIMIT 1`
  );
  if (!rows.length) return null;
  return parseInt(rows[0].id, 10);
}

export interface TicketUpdateFields {
  title?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignee_id?: number | null;
}

export async function updateTicket(id: number, fields: TicketUpdateFields): Promise<Ticket | null> {
  const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const params: unknown[] = [];
  let idx = 1;
  if (fields.title !== undefined) {
    updates.push(`title = $${idx++}`);
    params.push(fields.title);
  }
  if (fields.description !== undefined) {
    updates.push(`description = $${idx++}`);
    params.push(fields.description);
  }
  if (fields.category !== undefined) {
    updates.push(`category = $${idx++}`);
    params.push(fields.category);
  }
  if (fields.priority !== undefined) {
    updates.push(`priority = $${idx++}`);
    params.push(fields.priority);
  }
  if (fields.status !== undefined) {
    updates.push(`status = $${idx++}`);
    params.push(fields.status);
    if (fields.status === 'in_progress') {
      updates.push("first_response_at = COALESCE(first_response_at, CURRENT_TIMESTAMP)");
    }
    if (fields.status === 'completed' || fields.status === 'closed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }
  }
  if (fields.assignee_id !== undefined) {
    updates.push(`assignee_id = $${idx++}`);
    params.push(fields.assignee_id);
  }
  if (updates.length <= 1) return findTicketById(id);
  params.push(id);
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return row as unknown as Ticket | null;
}

export async function deleteTicket(id: number): Promise<boolean> {
  const rows = await query<Record<string, unknown>>('DELETE FROM tickets WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

/**
 * 用户级删除：将工单标记为“对创建人隐藏”，仅对普通用户列表与详情生效，不影响管理员和技术员。
 */
export async function setDeletedByUser(ticketId: number): Promise<boolean> {
  const rows = await query<Record<string, unknown>>(
    'UPDATE tickets SET deleted_by_user = true WHERE id = $1 RETURNING id',
    [ticketId]
  );
  return rows.length > 0;
}

export async function listTickets(filters: TicketFilters, limit = 50, offset = 0): Promise<TicketWithCreator[]> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let i = 1;
  if (filters.status) {
    conditions.push(`t.status = $${i}`);
    params.push(filters.status);
    i++;
  }
  if (filters.priority) {
    conditions.push(`t.priority = $${i}`);
    params.push(filters.priority);
    i++;
  }
  if (filters.category) {
    conditions.push(`t.category = $${i}`);
    params.push(filters.category);
    i++;
  }
  if (filters.assignee_id !== undefined) {
    conditions.push(`t.assignee_id = $${i}`);
    params.push(filters.assignee_id);
    i++;
  }
  if (filters.creator_id !== undefined) {
    conditions.push(`t.creator_id = $${i}`);
    params.push(filters.creator_id);
    i++;
  }
  if (filters.search) {
    conditions.push(`(t.title ILIKE $${i} OR t.description ILIKE $${i})`);
    params.push(`%${filters.search}%`);
    i++;
  }
  if (filters.exclude_deleted_by_user) {
    conditions.push('(t.deleted_by_user = false OR t.deleted_by_user IS NULL)');
  }
  params.push(limit, offset);
  const sql = `
    SELECT t.*, u1.name AS creator_name, u2.name AS assignee_name
    FROM tickets t
    LEFT JOIN users u1 ON t.creator_id = u1.id
    LEFT JOIN users u2 ON t.assignee_id = u2.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.created_at DESC
    LIMIT $${i} OFFSET $${i + 1}
  `;
  const rows = await query<Record<string, unknown>>(sql, params);
  return rows as unknown as TicketWithCreator[];
}

export async function countTickets(filters: TicketFilters): Promise<number> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let i = 1;
  if (filters.status) {
    conditions.push(`status = $${i}`);
    params.push(filters.status);
    i++;
  }
  if (filters.priority) {
    conditions.push(`priority = $${i}`);
    params.push(filters.priority);
    i++;
  }
  if (filters.category) {
    conditions.push(`category = $${i}`);
    params.push(filters.category);
    i++;
  }
  if (filters.assignee_id !== undefined) {
    conditions.push(`assignee_id = $${i}`);
    params.push(filters.assignee_id);
    i++;
  }
  if (filters.creator_id !== undefined) {
    conditions.push(`creator_id = $${i}`);
    params.push(filters.creator_id);
    i++;
  }
  if (filters.search) {
    conditions.push(`(title ILIKE $${i} OR description ILIKE $${i})`);
    params.push(`%${filters.search}%`);
  }
  if (filters.exclude_deleted_by_user) {
    conditions.push('(deleted_by_user = false OR deleted_by_user IS NULL)');
  }
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM tickets WHERE ${conditions.join(' AND ')}`,
    params
  );
  return row ? parseInt(row.count, 10) : 0;
}

export async function getStats(): Promise<{
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  closed: number;
  today_count: number;
  avgResponseMinutes: number | null;
}> {
  const [totalRow, pendingRow, inProgressRow, completedRow, closedRow, todayRow, avgRow] = await Promise.all([
    queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM tickets'),
    queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM tickets WHERE status = 'pending'"),
    queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM tickets WHERE status = 'in_progress'"),
    queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM tickets WHERE status = 'completed'"),
    queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM tickets WHERE status = 'closed'"),
    queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM tickets WHERE created_at::date = CURRENT_DATE"),
    queryOne<{ avg: string | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/60)::numeric(10,2) AS avg
       FROM tickets WHERE first_response_at IS NOT NULL`
    ),
  ]);
  return {
    total: totalRow ? parseInt(totalRow.count, 10) : 0,
    pending: pendingRow ? parseInt(pendingRow.count, 10) : 0,
    in_progress: inProgressRow ? parseInt(inProgressRow.count, 10) : 0,
    completed: completedRow ? parseInt(completedRow.count, 10) : 0,
    closed: closedRow ? parseInt(closedRow.count, 10) : 0,
    today_count: todayRow ? parseInt(todayRow.count, 10) : 0,
    avgResponseMinutes: avgRow?.avg != null ? parseFloat(avgRow.avg) : null,
  };
}

/** 近 N 天每日工单创建数、完成数，用于仪表盘趋势图。dates 为 YYYY-MM-DD，与 created/resolved 一一对应。 */
export async function getTrendData(days: number = 7): Promise<{
  dates: string[];
  created: number[];
  resolved: number[];
}> {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const created: number[] = [];
  const resolved: number[] = [];
  for (const date of dates) {
    const [cRow, rRow] = await Promise.all([
      queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM tickets WHERE created_at::date = $1`,
        [date]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM tickets
         WHERE (status = 'completed' OR status = 'closed') AND completed_at::date = $1`,
        [date]
      ),
    ]);
    created.push(cRow ? parseInt(cRow.count, 10) : 0);
    resolved.push(rRow ? parseInt(rRow.count, 10) : 0);
  }
  return { dates, created, resolved };
}

/** 技术员维度：当前指派未完成工单数 + 已完成工单数（历史累计），用于仪表盘技术员负载图。 */
export async function getTechStats(): Promise<
  { techId: number; techName: string; assignedCount: number; resolvedCount: number }[]
> {
  const rows = await query<{ tech_id: string; tech_name: string; assigned: string; resolved: string }>(
    `SELECT u.id::text AS tech_id, u.name AS tech_name,
            COUNT(t1.id)::text AS assigned,
            (SELECT COUNT(*) FROM tickets t2 WHERE t2.assignee_id = u.id AND t2.status IN ('completed', 'closed'))::text AS resolved
     FROM users u
     LEFT JOIN tickets t1 ON t1.assignee_id = u.id AND t1.status IN ('pending', 'in_progress')
     WHERE u.deleted_at IS NULL AND u.role = 'technician' AND (u.status = 'active' OR u.status IS NULL)
     GROUP BY u.id, u.name
     ORDER BY u.name`
  );
  return rows.map((r) => ({
    techId: parseInt(r.tech_id, 10),
    techName: r.tech_name || '未知',
    assignedCount: parseInt(r.assigned, 10) || 0,
    resolvedCount: parseInt(r.resolved, 10) || 0,
  }));
}

/**
 * 当前登录技术员专属统计：指派给自己的工单完成率等，用于工单列表页「我的完成率」卡片。
 */
export async function getTechStatsForCurrentUser(techId: number): Promise<{
  completionRate: number;
  completedCount: number;
  totalAssigned: number;
  todayCompleted: number;
}> {
  const [totalRow, completedRow, todayRow] = await Promise.all([
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tickets WHERE assignee_id = $1`,
      [techId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tickets
       WHERE assignee_id = $1 AND status IN ('completed', 'closed')`,
      [techId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tickets
       WHERE assignee_id = $1 AND status IN ('completed', 'closed')
         AND completed_at::date = CURRENT_DATE`,
      [techId]
    ),
  ]);
  const totalAssigned = totalRow ? parseInt(totalRow.count, 10) : 0;
  const completedCount = completedRow ? parseInt(completedRow.count, 10) : 0;
  const todayCompleted = todayRow ? parseInt(todayRow.count, 10) : 0;
  const completionRate =
    totalAssigned === 0 ? 100 : Math.round((completedCount / totalAssigned) * 1000) / 10;
  return {
    completionRate,
    completedCount,
    totalAssigned,
    todayCompleted,
  };
}

/**
 * SLA 达标统计（首响 24 小时内视为达标）。
 * - 达标工单：有首响且 (first_response_at - created_at) <= 24 小时
 * - 达标率 = 达标工单数 / 总工单数 × 100（总数为 0 时返回 100）
 * - 超时工单：待处理/处理中 且 创建超过 24h 且 尚未首响
 */
export async function getSlaStats(): Promise<{
  slaRate: number;
  metCount: number;
  totalCount: number;
  overdueCount: number;
}> {
  const [totalRow, metRow, overdueRow] = await Promise.all([
    queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM tickets'),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tickets
       WHERE first_response_at IS NOT NULL
         AND EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600 <= 24`
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tickets
       WHERE status IN ('pending', 'in_progress')
         AND first_response_at IS NULL
         AND created_at < NOW() - INTERVAL '24 hours'`
    ),
  ]);
  const totalCount = totalRow ? parseInt(totalRow.count, 10) : 0;
  const metCount = metRow ? parseInt(metRow.count, 10) : 0;
  const overdueCount = overdueRow ? parseInt(overdueRow.count, 10) : 0;
  const slaRate = totalCount === 0 ? 100 : Math.round((metCount / totalCount) * 1000) / 10;
  return {
    slaRate,
    metCount,
    totalCount,
    overdueCount,
  };
}

/** 技术人员个人仪表盘：KPI（仅统计 assignee_id = techId 的工单） */
export async function getTechDashboardKpi(techId: number): Promise<{
  total: number;
  pending: number;
  in_progress: number;
  today_count: number;
  avgResponseMinutes: number | null;
  completionRate: number;
  completedCount: number;
  totalAssigned: number;
  overdueCount: number;
}> {
  const base = `assignee_id = $1`;
  const [totalRow, pendingRow, inProgressRow, todayRow, avgRow, completedRow, overdueRow] = await Promise.all([
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE ${base}`, [techId]),
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE ${base} AND status = 'pending'`, [techId]),
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE ${base} AND status = 'in_progress'`, [techId]),
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE ${base} AND created_at::date = CURRENT_DATE`, [techId]),
    queryOne<{ avg: string | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/60)::numeric(10,2) AS avg
       FROM tickets WHERE ${base} AND first_response_at IS NOT NULL`,
      [techId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tickets WHERE ${base} AND status IN ('completed', 'closed')`,
      [techId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tickets
       WHERE ${base} AND status IN ('pending', 'in_progress') AND first_response_at IS NULL
         AND created_at < NOW() - INTERVAL '24 hours'`,
      [techId]
    ),
  ]);
  const total = totalRow ? parseInt(totalRow.count, 10) : 0;
  const completedCount = completedRow ? parseInt(completedRow.count, 10) : 0;
  const completionRate = total === 0 ? 100 : Math.round((completedCount / total) * 1000) / 10;
  return {
    total,
    pending: pendingRow ? parseInt(pendingRow.count, 10) : 0,
    in_progress: inProgressRow ? parseInt(inProgressRow.count, 10) : 0,
    today_count: todayRow ? parseInt(todayRow.count, 10) : 0,
    avgResponseMinutes: avgRow?.avg != null ? parseFloat(avgRow.avg) : null,
    completionRate,
    completedCount,
    totalAssigned: total,
    overdueCount: overdueRow ? parseInt(overdueRow.count, 10) : 0,
  };
}

/** 技术人员个人：工单状态分布（assignee_id = techId） */
export async function getTechStatusDistribution(techId: number): Promise<{
  pending: number;
  in_progress: number;
  completed: number;
  closed: number;
}> {
  const [a, b, c, d] = await Promise.all([
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE assignee_id = $1 AND status = 'pending'`, [techId]),
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE assignee_id = $1 AND status = 'in_progress'`, [techId]),
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE assignee_id = $1 AND status = 'completed'`, [techId]),
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE assignee_id = $1 AND status = 'closed'`, [techId]),
  ]);
  return {
    pending: a ? parseInt(a.count, 10) : 0,
    in_progress: b ? parseInt(b.count, 10) : 0,
    completed: c ? parseInt(c.count, 10) : 0,
    closed: d ? parseInt(d.count, 10) : 0,
  };
}

/** 技术人员个人：工单优先级分布（assignee_id = techId） */
export async function getTechPriorityDistribution(techId: number): Promise<{
  high: number;
  medium: number;
  low: number;
}> {
  const [a, b, c] = await Promise.all([
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE assignee_id = $1 AND priority = 'high'`, [techId]),
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE assignee_id = $1 AND priority = 'medium'`, [techId]),
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE assignee_id = $1 AND priority = 'low'`, [techId]),
  ]);
  return {
    high: a ? parseInt(a.count, 10) : 0,
    medium: b ? parseInt(b.count, 10) : 0,
    low: c ? parseInt(c.count, 10) : 0,
  };
}

/** 技术人员个人：近 N 天每日创建数、完成数（assignee_id = techId） */
export async function getTechTrend(techId: number, days: number = 7): Promise<{
  dates: string[];
  created: number[];
  resolved: number[];
}> {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const created: number[] = [];
  const resolved: number[] = [];
  for (const date of dates) {
    const [cRow, rRow] = await Promise.all([
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tickets WHERE assignee_id = $1 AND created_at::date = $2`,
        [techId, date]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tickets
         WHERE assignee_id = $1 AND status IN ('completed', 'closed') AND completed_at::date = $2`,
        [techId, date]
      ),
    ]);
    created.push(cRow ? parseInt(cRow.count, 10) : 0);
    resolved.push(rRow ? parseInt(rRow.count, 10) : 0);
  }
  return { dates, created, resolved };
}

/** 技术人员个人：SLA 达标统计（仅 assignee_id = techId 的工单） */
export async function getTechSla(techId: number): Promise<{
  slaRate: number;
  metCount: number;
  totalCount: number;
  overdueCount: number;
}> {
  const base = 'assignee_id = $1';
  const [totalRow, metRow, overdueRow] = await Promise.all([
    queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets WHERE ${base}`, [techId]),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tickets
       WHERE ${base} AND first_response_at IS NOT NULL
         AND EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600 <= 24`,
      [techId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tickets
       WHERE ${base} AND status IN ('pending', 'in_progress') AND first_response_at IS NULL
         AND created_at < NOW() - INTERVAL '24 hours'`,
      [techId]
    ),
  ]);
  const totalCount = totalRow ? parseInt(totalRow.count, 10) : 0;
  const metCount = metRow ? parseInt(metRow.count, 10) : 0;
  const overdueCount = overdueRow ? parseInt(overdueRow.count, 10) : 0;
  const slaRate = totalCount === 0 ? 100 : Math.round((metCount / totalCount) * 1000) / 10;
  return { slaRate, metCount, totalCount, overdueCount };
}
