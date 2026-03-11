-- 用户管理功能：为 users 表增加账号状态与最后登录时间
-- 执行: psql -d itsm -f server/scripts/migrate-users-management.sql
-- （Mac 本地常用当前用户连接，无需 -U postgres；若使用 postgres 用户则加 -U postgres）

-- 若列已存在可忽略错误，或先检查：SELECT column_name FROM information_schema.columns WHERE table_name = 'users';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- 为列表查询建索引（可选，按需）
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
