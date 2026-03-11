/**
 * 创建初始管理员账号脚本
 * 用法（在 server 目录下）：npm run create-admin -- -e admin@example.com -p yourpassword
 * 或：npx ts-node -r dotenv/config scripts/create-admin.ts -e admin@example.com -p yourpassword
 *
 * 若数据库中已存在管理员，则提示并退出，不覆盖。
 */

import path from 'path';
import dotenv from 'dotenv';

// 确保在 server 目录下加载 .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import bcrypt from 'bcryptjs';
import { countAdmins, createUser, findUserByEmail } from '../src/models/user';

function parseArgs(): { email: string; password: string } {
  const argv = process.argv.slice(2);
  let email = '';
  let password = '';
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '-e' || argv[i] === '--email') && argv[i + 1]) {
      email = argv[i + 1].trim();
      i++;
    } else if ((argv[i] === '-p' || argv[i] === '--password') && argv[i + 1]) {
      password = argv[i + 1];
      i++;
    }
  }
  return { email, password };
}

async function main(): Promise<void> {
  const { email, password } = parseArgs();
  if (!email || !password) {
    console.error('用法: npm run create-admin -- -e <邮箱> -p <密码>');
    console.error('示例: npm run create-admin -- -e admin@example.com -p yourpassword');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('密码至少 6 位');
    process.exit(1);
  }

  try {
    const adminCount = await countAdmins();
    if (adminCount > 0) {
      console.log('管理员账号已存在，操作取消。');
      process.exit(0);
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      console.error('该邮箱已被注册，请使用其他邮箱或先在用户管理中修改该用户角色为管理员。');
      process.exit(1);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await createUser(email, hashedPassword, '管理员', 'admin');
    console.log(`管理员账号创建成功：${email}`);
    process.exit(0);
  } catch (err) {
    console.error('创建失败：', err);
    process.exit(1);
  }
}

main();
