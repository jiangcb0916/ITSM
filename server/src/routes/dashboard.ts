import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get(
  '/trend',
  validate(dashboardController.trendValidators),
  dashboardController.trend
);

router.get(
  '/tech-stats',
  dashboardController.techStats
);

router.get(
  '/sla',
  dashboardController.sla
);

export default router;
