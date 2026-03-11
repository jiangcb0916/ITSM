import { Router } from 'express';
import * as ticketController from '../controllers/ticketController';
import { authenticate, requireRole } from '../middleware/auth';
import { checkTicketAccess } from '../middleware/ticketAccess';
import { validate } from '../middleware/validate';
import { uploadTicketImages } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validate(ticketController.createValidators),
  ticketController.create
);

/** 创建工单并上传问题截图（multipart/form-data），字段：title, description, category, priority, assigned_to；文件：screenshots（最多 5 张） */
router.post(
  '/with-attachments',
  (req, res, next) => {
    uploadTicketImages(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  },
  ticketController.createWithAttachments
);

router.get(
  '/',
  validate(ticketController.listValidators),
  ticketController.list
);

router.get(
  '/stats',
  requireRole('admin', 'technician'),
  ticketController.stats
);

router.get(
  '/tech-stats',
  requireRole('technician'),
  ticketController.techStats
);

router.get(
  '/:id',
  validate(ticketController.getByIdValidators),
  checkTicketAccess,
  ticketController.getById
);

router.patch(
  '/:id/status',
  checkTicketAccess,
  requireRole('admin', 'technician'),
  validate(ticketController.updateStatusValidators),
  ticketController.updateStatus
);

router.patch(
  '/:id/assign',
  checkTicketAccess,
  requireRole('admin'),
  validate(ticketController.assignValidators),
  ticketController.assign
);

router.put(
  '/:id',
  validate(ticketController.putValidators),
  checkTicketAccess,
  requireRole('admin', 'technician'),
  ticketController.putTicket
);

router.post(
  '/:id/comments',
  validate(ticketController.addCommentValidators),
  checkTicketAccess,
  ticketController.addComment
);

router.delete(
  '/:id',
  checkTicketAccess,
  requireRole('admin'),
  ticketController.removeTicket
);

router.put(
  '/:id/user-delete',
  validate(ticketController.getByIdValidators),
  checkTicketAccess,
  ticketController.userDelete
);

export default router;
