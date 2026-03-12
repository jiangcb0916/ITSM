import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { config } from '../config';
import { findUserByEmail, createUser, updateLastLoginAt } from '../models/user';
import { validate } from '../middleware/validate';
import { JwtPayload } from '../types';

// 注册仅允许创建普通用户，不接收 role 或忽略前端传入的 role
export const registerValidators = [
  body('email').isEmail().withMessage('邮箱格式无效').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  body('name').trim().notEmpty().withMessage('姓名不能为空'),
];

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body as {
      email: string;
      password: string;
      name: string;
    };
    // 邮箱后缀限制：若配置了允许的域名，则只允许这些后缀注册
    const allowedDomains = config.allowedEmailDomains;
    if (allowedDomains && allowedDomains.length > 0) {
      const domain = email.includes('@') ? email.split('@')[1]?.toLowerCase() : '';
      if (!domain || !allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
        res.status(400).json({
          success: false,
          message: `只允许使用公司邮箱 (@${allowedDomains.join('、@')}) 注册`,
        });
        return;
      }
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(400).json({ error: '该邮箱已注册' });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    // 注册接口强制为普通用户，技术人员/管理员由管理员在用户管理中分配
    const user = await createUser(email, hash, name, 'user');
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role } as JwtPayload,
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error('Register error:', e);
    const msg = e instanceof Error ? e.message : '注册失败';
    res.status(500).json({ error: msg });
  }
}

export const loginValidators = [
  body('email').isEmail().withMessage('邮箱格式无效').normalizeEmail(),
  body('password').notEmpty().withMessage('需要密码'),
];

/** 登录接口统一错误格式 */
function loginError(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, message });
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await findUserByEmail(email);
    if (!user) {
      loginError(res, 404, '该邮箱未注册，请先注册');
      return;
    }
    if (user.status === 'disabled') {
      loginError(res, 403, '您的账号已被禁用，请联系管理员');
      return;
    }
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      loginError(res, 401, '密码错误，请重新输入');
      return;
    }
    await updateLastLoginAt(user.id);
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role } as JwtPayload,
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error('Login error:', e);
    loginError(res, 500, '登录失败，请稍后重试');
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: '未认证' });
    return;
  }
  const { findUserById } = await import('../models/user');
  const user = await findUserById(req.user.userId);
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
