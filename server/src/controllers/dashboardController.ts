import { Request, Response } from 'express';
import { query as q } from 'express-validator';
import { validate } from '../middleware/validate';
import * as ticketModel from '../models/ticket';

export const trendValidators = [
  q('days').optional().isInt({ min: 1, max: 90 }).withMessage('days 应为 1–90'),
];

/**
 * GET /api/dashboard/trend?days=7
 * 返回近 N 天每日工单创建数、完成数，用于仪表盘趋势图。
 * 响应: { dates: string[], created: number[], resolved: number[] }
 */
export async function trend(req: Request, res: Response): Promise<void> {
  const days = Math.min(90, Math.max(1, parseInt(String(req.query.days || 7), 10) || 7));
  const data = await ticketModel.getTrendData(days);
  res.json(data);
}

/**
 * GET /api/dashboard/tech-stats
 * 返回技术员维度的当前指派未完成工单数、已完成工单数。
 * 响应: { techs: { techId, techName, assignedCount, resolvedCount }[] }
 */
export async function techStats(req: Request, res: Response): Promise<void> {
  const techs = await ticketModel.getTechStats();
  res.json({ techs });
}

/**
 * GET /api/dashboard/sla
 * 返回 SLA 达标率（达标工单数/总工单数）、达标数、总数、超时工单数。
 * 响应: { slaRate: number, metCount: number, totalCount: number, overdueCount: number }
 */
export async function sla(req: Request, res: Response): Promise<void> {
  const data = await ticketModel.getSlaStats();
  res.json(data);
}

// ---------- 技术人员个人仪表盘（仅 technician 角色） ----------

/**
 * GET /api/dashboard/tech/kpi
 * 当前技术员个人 KPI（仅统计指派给自己的工单）。
 */
export async function techKpi(req: Request, res: Response): Promise<void> {
  if (!req.user || req.user.role !== 'technician') {
    res.status(403).json({ error: '仅技术人员可访问' });
    return;
  }
  const data = await ticketModel.getTechDashboardKpi(req.user.userId);
  res.json(data);
}

/**
 * GET /api/dashboard/tech/status-distribution
 * 当前技术员工单状态分布。
 */
export async function techStatusDistribution(req: Request, res: Response): Promise<void> {
  if (!req.user || req.user.role !== 'technician') {
    res.status(403).json({ error: '仅技术人员可访问' });
    return;
  }
  const data = await ticketModel.getTechStatusDistribution(req.user.userId);
  res.json(data);
}

/**
 * GET /api/dashboard/tech/priority-distribution
 * 当前技术员工单优先级分布。
 */
export async function techPriorityDistribution(req: Request, res: Response): Promise<void> {
  if (!req.user || req.user.role !== 'technician') {
    res.status(403).json({ error: '仅技术人员可访问' });
    return;
  }
  const data = await ticketModel.getTechPriorityDistribution(req.user.userId);
  res.json(data);
}

/**
 * GET /api/dashboard/tech/trend?days=7
 * 当前技术员近 N 天每日创建数、完成数。
 */
export async function techTrend(req: Request, res: Response): Promise<void> {
  if (!req.user || req.user.role !== 'technician') {
    res.status(403).json({ error: '仅技术人员可访问' });
    return;
  }
  const days = Math.min(90, Math.max(1, parseInt(String(req.query.days || 7), 10) || 7));
  const data = await ticketModel.getTechTrend(req.user.userId, days);
  res.json(data);
}

/**
 * GET /api/dashboard/tech/sla
 * 当前技术员指派工单的 SLA 达标率。
 */
export async function techSla(req: Request, res: Response): Promise<void> {
  if (!req.user || req.user.role !== 'technician') {
    res.status(403).json({ error: '仅技术人员可访问' });
    return;
  }
  const data = await ticketModel.getTechSla(req.user.userId);
  res.json(data);
}
