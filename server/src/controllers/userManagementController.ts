import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, param, query } from 'express-validator';
import * as userModel from '../models/user';
import { validate } from '../middleware/validate';
import { UserRole, UserStatus } from '../types';

export const listValidators = [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('search').optional().isString(),
  query('role').optional().isIn(['user', 'technician', 'admin']),
  query('status').optional().isIn(['active', 'disabled']),
];

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Math.max(1, parseInt(String(req.query.limit), 10) || 10), 100);
    const offset = Math.max(0, parseInt(String(req.query.offset), 10) || 0);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() || undefined : undefined;
    const role = (req.query.role as UserRole) || undefined;
    const status = (req.query.status as UserStatus) || undefined;
    const result = await userModel.listUsers({ limit, offset, search, role, status });
    res.json(result);
  } catch (e) {
    console.error('User list error:', e);
    res.status(500).json({ error: '获取用户列表失败' });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: '无效的用户 ID' });
    return;
  }
  const user = await userModel.findUserById(id);
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({ user });
}

export const updateValidators = [
  param('id').isInt({ min: 1 }).withMessage('无效的用户 ID'),
  body('email').optional().isEmail().withMessage('邮箱格式无效').normalizeEmail(),
  body('name').optional().trim().notEmpty().withMessage('姓名不能为空'),
  body('password').optional().isLength({ min: 6 }).withMessage('密码至少6位'),
  body('role').optional().isIn(['user', 'technician', 'admin']).withMessage('角色无效'),
  body('status').optional().isIn(['active', 'disabled']).withMessage('状态无效'),
];

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  const target = await userModel.findUserById(id);
  if (!target) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  if (target.role === 'admin') {
    res.status(403).json({ error: '不能修改其他管理员的信息' });
    return;
  }
  const { email, name, password, role, status } = req.body as {
    email?: string;
    name?: string;
    password?: string;
    role?: UserRole;
    status?: UserStatus;
  };
  const data: userModel.UpdateUserData = {};
  if (email !== undefined) data.email = email;
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (status !== undefined) data.status = status;
  if (password !== undefined) data.password = await bcrypt.hash(password, 10);
  try {
    const user = await userModel.updateUser(id, data);
    res.json({ user });
  } catch (e) {
    console.error('User update error:', e);
    if (e instanceof Error && e.message.includes('unique')) {
      res.status(400).json({ error: '该邮箱已被使用' });
      return;
    }
    res.status(500).json({ error: '更新用户失败' });
  }
}

export const setStatusValidators = [
  param('id').isInt({ min: 1 }).withMessage('无效的用户 ID'),
  body('status').isIn(['active', 'disabled']).withMessage('状态必须为 active 或 disabled'),
];

export async function setStatus(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  const target = await userModel.findUserById(id);
  if (!target) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  if (target.role === 'admin') {
    res.status(403).json({ error: '不能禁用其他管理员账号' });
    return;
  }
  const status = req.body.status as UserStatus;
  try {
    const user = await userModel.updateUser(id, { status });
    res.json({ user });
  } catch (e) {
    console.error('User setStatus error:', e);
    res.status(500).json({ error: '更新状态失败' });
  }
}

export const deleteValidators = [
  param('id').isInt({ min: 1 }).withMessage('无效的用户 ID'),
  body('transfer_user_id').optional().isInt({ min: 1 }).withMessage('转移目标用户 ID 无效'),
];

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  const target = await userModel.findUserById(id);
  if (!target) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  if (req.user?.userId === id) {
    res.status(403).json({ error: '不能删除自己的账号' });
    return;
  }
  if (target.role === 'admin') {
    const adminCount = await userModel.countAdmins();
    if (adminCount <= 1) {
      res.status(403).json({ error: '不能删除最后一名管理员' });
      return;
    }
  }
  const transferUserId = req.body.transfer_user_id != null ? parseInt(String(req.body.transfer_user_id), 10) : null;
  if (transferUserId !== null && (transferUserId === id || !Number.isInteger(transferUserId))) {
    res.status(400).json({ error: '转移目标用户无效' });
    return;
  }
  if (transferUserId != null) {
    const transferUser = await userModel.findUserById(transferUserId);
    if (!transferUser) {
      res.status(400).json({ error: '转移目标用户不存在' });
      return;
    }
  }
  try {
    await userModel.softDeleteUser(id, transferUserId);
    res.status(200).json({ message: '用户已删除' });
  } catch (e) {
    console.error('User delete error:', e);
    res.status(500).json({ error: '删除用户失败' });
  }
}
