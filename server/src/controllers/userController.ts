import { Request, Response } from 'express';
import * as userModel from '../models/user';

export async function listTechnicians(req: Request, res: Response): Promise<void> {
  const list = await userModel.listTechnicians();
  res.json({ users: list });
}

/** 返回所有 role=technician 且 status=active 的用户（id, name, email），用于创建工单时的指派下拉框 */
export async function listTechs(req: Request, res: Response): Promise<void> {
  const list = await userModel.listTechs();
  res.json({ users: list });
}
