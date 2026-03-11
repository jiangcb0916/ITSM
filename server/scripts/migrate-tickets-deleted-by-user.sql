-- 用户级删除：普通用户可从自己的列表中隐藏工单，管理员和技术员仍可见
-- 执行: psql -d itsm -f server/scripts/migrate-tickets-deleted-by-user.sql

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS deleted_by_user BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tickets_deleted_by_user ON tickets(deleted_by_user) WHERE deleted_by_user = true;

COMMENT ON COLUMN tickets.deleted_by_user IS '创建人是否从自己的列表中移除了该工单，仅影响普通用户列表与详情';
