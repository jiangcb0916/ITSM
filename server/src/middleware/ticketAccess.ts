import { Request, Response, NextFunction } from 'express';
import * as ticketModel from '../models/ticket';
import { Ticket } from '../types';

/**
 * 工单访问权限中间件：加载工单并根据角色判断是否允许访问
 * - 普通用户：仅当工单 creator_id === 当前用户 时允许
 * - 技术员：仅当工单 assignee_id === 当前用户 时允许
 * - 管理员：始终允许
 * 通过后将工单挂载到 req.ticket，供后续控制器使用
 */
export async function checkTicketAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: '未认证' });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id) || id < 1) {
    res.status(400).json({ error: '工单ID无效' });
    return;
  }
  const ticket = await ticketModel.findTicketById(id);
  if (!ticket) {
    res.status(404).json({ error: '工单不存在' });
    return;
  }
  const { role, userId } = req.user;
  if (role === 'admin') {
    req.ticket = ticket;
    next();
    return;
  }
  if (role === 'technician') {
    if (ticket.assignee_id !== userId) {
      res.status(403).json({ error: '无权访问该工单' });
      return;
    }
    req.ticket = ticket;
    next();
    return;
  }
  if (role === 'user') {
    if (ticket.creator_id !== userId) {
      res.status(403).json({ error: '无权访问该工单' });
      return;
    }
    req.ticket = ticket;
    next();
    return;
  }
  res.status(403).json({ error: '权限不足' });
}
