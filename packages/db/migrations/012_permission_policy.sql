-- Migration 012: Permission-based auto-reply guard (PermissionGuard CRM)
-- Run: wrangler d1 execute line-crm --file=packages/db/migrations/012_permission_policy.sql --remote

-- Add permission policy columns to auto_replies
ALTER TABLE auto_replies ADD COLUMN permission_mode TEXT NOT NULL DEFAULT 'allow_all';
ALTER TABLE auto_replies ADD COLUMN allowed_ranks TEXT DEFAULT NULL;

-- Add rank columns to friends
ALTER TABLE friends ADD COLUMN rank TEXT NOT NULL DEFAULT 'regular';
ALTER TABLE friends ADD COLUMN rank_updated_at TEXT DEFAULT NULL;
