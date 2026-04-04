-- Migration 014: LINE グループボット対応
-- agent_queueにグループ対応カラムを追加
-- タスク管理・リマインダーの軽量テーブルを追加

-- ============================================================
-- agent_queue 拡張
-- ============================================================
ALTER TABLE agent_queue ADD COLUMN line_user_id TEXT;
ALTER TABLE agent_queue ADD COLUMN source_type TEXT DEFAULT 'user';
ALTER TABLE agent_queue ADD COLUMN source_group_id TEXT;
ALTER TABLE agent_queue ADD COLUMN display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_queue_status_created
  ON agent_queue (status, created_at);

-- ============================================================
-- LINE タスク管理テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS line_tasks (
  id          TEXT PRIMARY KEY,
  group_id    TEXT,
  line_user_id TEXT,
  target_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done')),
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
  done_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_line_tasks_target
  ON line_tasks (target_id, status);

-- ============================================================
-- LINE リマインダーテーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS line_reminders (
  id          TEXT PRIMARY KEY,
  target_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  remind_at   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now', '+9 hours'))
);

CREATE INDEX IF NOT EXISTS idx_line_reminders_remind_at
  ON line_reminders (status, remind_at);

-- ============================================================
-- LINE 会話ログ（議事録用）
-- ============================================================
CREATE TABLE IF NOT EXISTS line_group_messages (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL,
  line_user_id TEXT,
  display_name TEXT,
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now', '+9 hours'))
);

CREATE INDEX IF NOT EXISTS idx_line_group_messages_group
  ON line_group_messages (group_id, created_at);
