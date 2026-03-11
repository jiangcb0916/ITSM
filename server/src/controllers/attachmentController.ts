import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { findTicketById } from '../models/ticket';
import { createAttachment, findAttachmentById } from '../models/attachment';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, '未认证');
  const ticketId = parseInt(req.params.id, 10);
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: '请选择文件' });
    return;
  }
  const ticket = await findTicketById(ticketId);
  if (!ticket) {
    fs.unlink(file.path, () => {});
    res.status(404).json({ error: '工单不存在' });
    return;
  }
  const canAccess = req.user.role === 'admin'
    || ticket.creator_id === req.user.userId
    || ticket.assignee_id === req.user.userId;
  if (!canAccess) {
    fs.unlink(file.path, () => {});
    res.status(403).json({ error: '无权操作该工单' });
    return;
  }
  const commentId = req.body.comment_id ? parseInt(req.body.comment_id, 10) : null;
  const attachment = await createAttachment(
    ticketId,
    req.user.userId,
    file.filename,
    file.originalname,
    file.path,
    commentId,
    file.mimetype,
    file.size
  );
  res.status(201).json({ attachment });
}

export async function download(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, '未认证');
  const id = parseInt(req.params.attachmentId, 10);
  const att = await findAttachmentById(id);
  if (!att) {
    res.status(404).json({ error: '附件不存在' });
    return;
  }
  const ticket = await findTicketById(att.ticket_id);
  if (!ticket) {
    res.status(404).json({ error: '工单不存在' });
    return;
  }
  const canAccess = req.user.role === 'admin'
    || ticket.creator_id === req.user.userId
    || ticket.assignee_id === req.user.userId;
  if (!canAccess) {
    res.status(403).json({ error: '无权下载' });
    return;
  }
  const fullPath = path.isAbsolute(att.path) ? att.path : path.join(config.upload.dir, att.path);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }
  res.download(fullPath, att.original_name);
}
