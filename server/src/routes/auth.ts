import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.post(
  '/register',
  validate(authController.registerValidators),
  authController.register
);

router.post(
  '/login',
  validate(authController.loginValidators),
  authController.login
);

router.get('/me', authenticate, authController.me);

export default router;
