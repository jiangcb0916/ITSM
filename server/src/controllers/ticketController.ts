import { Request, Response } from 'express';
import { body, param, query as q } from 'express-validator';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import * as ticketModel from '../models/ticket';
import * as commentModel from '../models/comment';
import * as userModel from '../models/user';
import * as notificationModel from '../models/notification';
import * as attachmentModel from '../models/attachment';
import { notifyTicketUpdate } from '../services/email';
import { TicketCategory, TicketPriority, TicketStatus } from '../types';

const categoryValues: TicketCategory[] = ['network', 'software', 'hardware', 'other'];
const priorityValues: TicketPriority[] = ['low', 'medium', 'high'];
const statusValues: TicketStatus[] = ['pending', 'in_progress', 'completed', 'closed'];

export const createValidators = [
  body('title').trim().notEmpty().withMessage('标题不能为空').isLength({ max: 255 }),
  body('description').trim().notEmpty().withMessage('描述不能为空'),
  body('category').optional().isIn(categoryValues).withMessage('分类无效'),
  body('priority').optional().isIn(priorityValues).withMessage('优先级无效'),
  body('assigned_to').optional().isInt({ min: 1 }).withMessage('指派人ID无效'),
];

/**
 * 创建工单。若提供 assigned_to则校验该用户存在且为技术员，否则使用自动分配（未完成工单最少的技术员）。
 */
export async function create(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, '未认证');
  const { title, description, category = 'other', priority = 'medium', assigned_to } = req.body;
  let assigneeId: number | null = null;
  if (assigned_to != null && assigned_to > 0) {
    const target = await userModel.findUserById(assigned_to);
    if (target && target.role === 'technician' && target.status === 'active') {
      assigneeId = assigned_to;
    }
  }
  if (assigneeId === null) {
    assigneeId = await ticketModel.getTechIdForAutoAssign();
  }
  const ticket = await ticketModel.createTicket(
    title,
    description,
    req.user.userId,
    category as TicketCategory,
    priority as TicketPriority,
    assigneeId
  );
  const [creator, assignee] = await Promise.all([
    userModel.findUserById(req.user.userId),
    assigneeId ? userModel.findUserById(assigneeId) : null,
  ]);
  res.status(201).json({
    ticket: {
      ...ticket,
      creator_name: creator?.name,
      assignee_name: assignee?.name,
    },
  });
}

const categoryValuesList: TicketCategory[] = ['network', 'software', 'hardware', 'other'];
const priorityValuesList: TicketPriority[] = ['low', 'medium', 'high'];

/**
 * 创建工单（multipart/form-data）：支持同时上传问题截图，保存到 attachments 表（comment_id 为空）。
 * 字段：title, description, category, priority, assigned_to（可选）；文件字段：screenshots（最多 5 张，仅图片，单张 ≤5MB）。
 */
export async function createWithAttachments(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, '未认证');
  const raw = req.body as Record<string, string>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const category = (raw.category && categoryValuesList.includes(raw.category as TicketCategory)) ? raw.category as TicketCategory : 'other';
  const priority = (raw.priority && priorityValuesList.includes(raw.priority as TicketPriority)) ? raw.priority as TicketPriority : 'medium';
  const assignedToRaw = raw.assigned_to;

  if (!title || !description) {
    res.status(400).json({ error: '标题和描述不能为空' });
    return;
  }

  let assigneeId: number | null = null;
  if (assignedToRaw != null && assignedToRaw !== '') {
    const parsed = parseInt(String(assignedToRaw), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const target = await userModel.findUserById(parsed);
      if (target && target.role === 'technician' && target.status === 'active') {
        assigneeId = parsed;
      }
    }
  }
  if (assigneeId === null) {
    assigneeId = await ticketModel.getTechIdForAutoAssign();
  }

  const ticket = await ticketModel.createTicket(
    title,
    description,
    req.user.userId,
    category,
    priority,
    assigneeId
  );

  const files = (req as Request & { files?: Express.Multer.File[] }).files;
  if (files && Array.isArray(files) && files.length > 0) {
    for (const file of files) {
      await attachmentModel.createAttachment(
        ticket.id,
        req.user!.userId,
        file.filename,
        file.originalname,
        file.path,
        null,
        file.mimetype,
        file.size
      );
    }
  }

  const [creator, assignee] = await Promise.all([
    userModel.findUserById(req.user.userId),
    assigneeId ? userModel.findUserById(assigneeId) : null,
  ]);
  res.status(201).json({
    ticket: {
      ...ticket,
      creator_name: creator?.name,
      assignee_name: assignee?.name,
    },
  });
}

export const listValidators = [
  q('status').optional().isIn(statusValues),
  q('priority').optional().isIn(priorityValues),
  q('category').optional().isIn(categoryValues),
  q('assignee_id').optional().isInt({ min: 1 }),
  q('search').optional().trim(),
  q('limit').optional().isInt({ min: 1, max: 100 }),
  q('offset').optional().isInt({ min: 0 }),
];

export async function list(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, '未认证');
  const { status, priority, category, assignee_id, search, limit, offset } = req.query as Record<string, string>;
  const filters: ticketModel.TicketFilters = {};
  if (status) filters.status = status as TicketStatus;
  if (priority) filters.priority = priority as TicketPriority;
  if (category) filters.category = category as TicketCategory;
  if (assignee_id) filters.assignee_id = parseInt(assignee_id, 10);
  if (search) filters.search = search;

  if (req.user.role === 'user') {
    filters.creator_id = req.user.userId;
    filters.exclude_deleted_by_user = true; // 普通用户列表中不显示已“用户删除”的工单
  } else if (req.user.role === 'technician') {
    filters.assignee_id = req.user.userId;
  }

  const limitNum = limit ? parseInt(limit, 10) : 50;
  const offsetNum = offset ? parseInt(offset, 10) : 0;
  const [tickets, total] = await Promise.all([
    ticketModel.listTickets(filters, limitNum, offsetNum),
    ticketModel.countTickets(filters),
  ]);
  res.json({ tickets, total });
}

export const getByIdValidators = [param('id').isInt({ min: 1 }).withMessage('工单ID无效')];

/** 工单详情，需配合 checkTicketAccess 中间件使用（req.ticket 已就绪） */
export async function getById(req: Request, res: Response): Promise<void> {
  const ticket = req.ticket!;
  if (req.user!.role === 'user' && ticket.deleted_by_user) {
    res.status(404).json({ error: '工单不存在或已从您的列表中移除' });
    return;
  }
  const id = ticket.id;
  const comments = await commentModel.listCommentsByTicketId(id, req.user!.role !== 'user');
  const { findAttachmentsByTicketId } = await import('../models/attachment');
  const attachments = await findAttachmentsByTicketId(id);
  const [creator, assignee] = await Promise.all([
    userModel.findUserById(ticket.creator_id),
    ticket.assignee_id ? userModel.findUserById(ticket.assignee_id) : null,
  ]);
  res.json({
    ticket: {
      ...ticket,
      creator_name: creator?.name,
      assignee_name: assignee?.name,
    },
    comments,
    attachments,
  });
}

export const updateStatusValidators = [
  param('id').isInt({ min: 1 }),
  body('status').isIn(statusValues).withMessage('状态无效'),
  body('assignee_id').optional().isInt({ min: 1 }),
];

/** 更新工单状态（及可选指派人），需配合 checkTicketAccess。技术员只能更新指派给自己的工单。 */
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const ticket = req.ticket!;
  const id = ticket.id;
  const { status, assignee_id } = req.body as { status: TicketStatus; assignee_id?: number };
  if (req.user!.role === 'technician' && assignee_id !== undefined) {
    res.status(403).json({ error: '技术员不能修改指派人' });
    return;
  }
  const assigneeId = assignee_id !== undefined ? assignee_id : ticket.assignee_id;
  const updated = await ticketModel.updateTicketStatus(id, status, assigneeId ?? undefined);
  if (!updated) {
    res.status(500).json({ error: '更新失败' });
    return;
  }
  const creator = await userModel.findUserById(ticket.creator_id);
  const assignee = assigneeId ? await userModel.findUserById(assigneeId) : null;
  const toEmails: { email: string; userId: number }[] = [];
  if (creator) toEmails.push({ email: creator.email, userId: creator.id });
  if (assignee && assignee.id !== creator?.id) toEmails.push({ email: assignee.email, userId: assignee.id });
  const msg = `状态已更新为：${status}`;
  for (const { email, userId } of toEmails) {
    await notifyTicketUpdate(email, id, ticket.title, msg);
    await notificationModel.createNotification(userId, `工单 #${id} 状态更新`, msg, id);
  }
  res.json({ ticket: updated });
}

export const assignValidators = [
  param('id').isInt({ min: 1 }),
  body('assignee_id').isInt({ min: 1 }).withMessage('请指定指派人'),
];

/** 分配工单（仅管理员），需配合 checkTicketAccess */
export async function assign(req: Request, res: Response): Promise<void> {
  const ticket = req.ticket!;
  const id = ticket.id;
  const { assignee_id } = req.body as { assignee_id: number };
  const updated = await ticketModel.assignTicket(id, assignee_id);
  if (!updated) {
    res.status(500).json({ error: '分配失败' });
    return;
  }
  const assignee = await userModel.findUserById(assignee_id);
  if (assignee) {
    await notifyTicketUpdate(assignee.email, id, ticket.title, '该工单已分配给您处理');
    await notificationModel.createNotification(assignee.id, `工单 #${id} 已分配给您`, null, id);
  }
  res.json({ ticket: updated });
}

export const addCommentValidators = [
  param('id').isInt({ min: 1 }),
  body('content').trim().notEmpty().withMessage('评论内容不能为空'),
  body('is_internal').optional().isBoolean(),
];

/** 添加评论，需配合 checkTicketAccess。创建人、指派人、管理员均可评论。 */
export async function addComment(req: Request, res: Response): Promise<void> {
  const ticket = req.ticket!;
  const id = ticket.id;
  const { content, is_internal } = req.body as { content: string; is_internal?: boolean };
  if (req.user!.role === 'user' && is_internal) {
    res.status(403).json({ error: '普通用户不能添加内部备注' });
    return;
  }
  const comment = await commentModel.createComment(id, req.user!.userId, content, is_internal === true);
  const creator = await userModel.findUserById(ticket.creator_id);
  const assignee = ticket.assignee_id ? await userModel.findUserById(ticket.assignee_id) : null;
  const notifyUserId = req.user!.userId === ticket.creator_id ? assignee?.id : ticket.creator_id;
  if (notifyUserId && creator) {
    const toUser = notifyUserId === ticket.creator_id ? creator : assignee;
    if (toUser) {
      await notifyTicketUpdate(toUser.email, id, ticket.title, `新评论：${content.slice(0, 50)}...`);
      await notificationModel.createNotification(toUser.id, `工单 #${id} 有新评论`, content.slice(0, 200), id);
    }
  }
  const user = await userModel.findUserById(req.user!.userId);
  res.status(201).json({ comment: { ...comment, user_name: user?.name } });
}

export async function stats(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, '未认证');
  if (req.user.role !== 'admin' && req.user.role !== 'technician') {
    res.status(403).json({ error: '仅管理员或技术人员可查看统计' });
    return;
  }
  const statsData = await ticketModel.getStats();
  res.json(statsData);
}

/** 技术人员专属：当前登录技术员的指派工单完成率等，用于工单列表页「我的完成率」卡片 */
export async function techStats(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, '未认证');
  if (req.user.role !== 'technician') {
    res.status(403).json({ error: '仅技术人员可查看' });
    return;
  }
  const data = await ticketModel.getTechStatsForCurrentUser(req.user.userId);
  res.json(data);
}

export const putValidators = [
  param('id').isInt({ min: 1 }),
  body('title').optional().trim().notEmpty().isLength({ max: 255 }),
  body('description').optional().trim().notEmpty(),
  body('category').optional().isIn(categoryValues),
  body('priority').optional().isIn(priorityValues),
  body('status').optional().isIn(statusValues),
  body('assignee_id').optional().isInt({ min: 1 }),
];

/**
 * 更新工单（PUT）：技术员仅可更新 status；管理员可更新全部字段（含 assignee_id）。
 * 需配合 checkTicketAccess。
 */
export async function putTicket(req: Request, res: Response): Promise<void> {
  const ticket = req.ticket!;
  const id = ticket.id;
  const role = req.user!.role;
  if (role === 'user') {
    res.status(403).json({ error: '普通用户不能编辑工单' });
    return;
  }
  const body = req.body as {
    title?: string;
    description?: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    status?: TicketStatus;
    assignee_id?: number;
  };
  const fields: ticketModel.TicketUpdateFields = {};
  if (role === 'admin') {
    if (body.title !== undefined) fields.title = body.title;
    if (body.description !== undefined) fields.description = body.description;
    if (body.category !== undefined) fields.category = body.category;
    if (body.priority !== undefined) fields.priority = body.priority;
    if (body.status !== undefined) fields.status = body.status;
    if (body.assignee_id !== undefined) fields.assignee_id = body.assignee_id;
  } else {
    if (body.status !== undefined) fields.status = body.status;
  }
  if (Object.keys(fields).length === 0) {
    const t = await ticketModel.findTicketById(id);
    return void res.json({ ticket: t });
  }
  const updated = await ticketModel.updateTicket(id, fields);
  if (!updated) {
    res.status(500).json({ error: '更新失败' });
    return;
  }
  if (fields.status) {
    const creator = await userModel.findUserById(ticket.creator_id);
    const assignee = updated.assignee_id ? await userModel.findUserById(updated.assignee_id) : null;
    const msg = `状态已更新为：${fields.status}`;
    if (creator) {
      await notifyTicketUpdate(creator.email, id, ticket.title, msg);
      await notificationModel.createNotification(creator.id, `工单 #${id} 状态更新`, msg, id);
    }
    if (assignee && assignee.id !== creator?.id) {
      await notifyTicketUpdate(assignee.email, id, ticket.title, msg);
      await notificationModel.createNotification(assignee.id, `工单 #${id} 状态更新`, msg, id);
    }
  }
  res.json({ ticket: updated });
}

/** 删除工单，仅管理员，需配合 checkTicketAccess */
export async function removeTicket(req: Request, res: Response): Promise<void> {
  const id = req.ticket!.id;
  const ok = await ticketModel.deleteTicket(id);
  if (!ok) {
    res.status(500).json({ error: '删除失败' });
    return;
  }
  res.status(200).json({ message: '工单已删除' });
}

/**
 * 用户级删除：仅工单创建者（普通用户）可调用，将工单从自己的列表中隐藏；
 * 管理员和技术员不受影响，仍可见并处理该工单。
 */
export async function userDelete(req: Request, res: Response): Promise<void> {
  const ticket = req.ticket!;
  if (req.user!.role !== 'user') {
    res.status(403).json({ error: '仅工单创建者可执行此操作' });
    return;
  }
  if (ticket.creator_id !== req.user!.userId) {
    res.status(403).json({ error: '仅工单创建者可执行此操作' });
    return;
  }
  const ok = await ticketModel.setDeletedByUser(ticket.id);
  if (!ok) {
    res.status(500).json({ error: '操作失败' });
    return;
  }
  res.status(200).json({ message: '已从您的列表中移除' });
}
