import { Router } from 'express';
import * as attachmentController from '../controllers/attachmentController';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.post(
  '/:id/upload',
  upload.single('file'),
  attachmentController.uploadAttachment
);

router.get(
  '/:id/download/:attachmentId',
  attachmentController.download
);

export default router;
