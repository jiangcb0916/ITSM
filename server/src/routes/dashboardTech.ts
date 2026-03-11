import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.use(requireRole('technician'));

router.get('/kpi', dashboardController.techKpi);
router.get('/status-distribution', dashboardController.techStatusDistribution);
router.get('/priority-distribution', dashboardController.techPriorityDistribution);
router.get('/trend', validate(dashboardController.trendValidators), dashboardController.techTrend);
router.get('/sla', dashboardController.techSla);

export default router;
