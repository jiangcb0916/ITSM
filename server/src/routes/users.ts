import { Router } from 'express';
import * as userController from '../controllers/userController';
import * as userManagementController from '../controllers/userManagementController';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.get(
  '/technicians',
  authenticate,
  requireRole('admin'),
  userController.listTechnicians
);

router.get(
  '/techs',
  authenticate,
  userController.listTechs
);

router.get(
  ['', '/'],
  authenticate,
  requireRole('admin'),
  validate(userManagementController.listValidators),
  userManagementController.list
);

router.get(
  '/:id',
  authenticate,
  requireRole('admin'),
  userManagementController.getById
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(userManagementController.updateValidators),
  userManagementController.update
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  validate(userManagementController.setStatusValidators),
  userManagementController.setStatus
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(userManagementController.deleteValidators),
  userManagementController.remove
);

export default router;
