-- 用户软删除：为 users 表增加 deleted_at
-- 执行: psql -d itsm -f server/scripts/migrate-users-soft-delete.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

COMMENT ON COLUMN users.deleted_at IS '软删除时间，非空表示已删除';
