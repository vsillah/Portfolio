-- time_entries.draft.sql
-- Schema reference for time tracking (client portal + admin).
-- Applied migration: 2026_03_15_time_entries.sql
--
-- Phase 3 (Client Portal Gap Closure plan): design doc only; migration already applied.
-- Implementation chose polymorphic target + start/stop timer (vs plan's milestone_index + duration_minutes).

-- Table: time_entries
-- Purpose: Track time spent on client project milestones or dashboard tasks.
-- Pattern: Polymorphic target (target_type + target_id); start/stop timer via is_running.

-- Columns:
--   id                 UUID PK, default gen_random_uuid()
--   client_project_id  UUID NOT NULL → client_projects(id) ON DELETE CASCADE
--   target_type        TEXT NOT NULL  CHECK (target_type IN ('milestone', 'task'))
--   target_id          TEXT NOT NULL  -- milestone index (e.g. '0','1') or dashboard_tasks.id
--   description        TEXT           -- optional note
--   duration_seconds   INTEGER        -- set when timer stopped or manual entry
--   started_at         TIMESTAMPTZ    -- when timer started (null for manual-only entries)
--   stopped_at         TIMESTAMPTZ    -- when timer stopped
--   is_running         BOOLEAN DEFAULT false  -- only one running per user/project in practice
--   created_by         UUID → auth.users(id)
--   created_at         TIMESTAMPTZ DEFAULT now()
--   updated_at         TIMESTAMPTZ DEFAULT now()

-- Indexes:
--   idx_time_entries_project  ON time_entries(client_project_id)
--   idx_time_entries_target   ON time_entries(target_type, target_id)
--   idx_time_entries_running  ON time_entries(is_running) WHERE is_running = true

-- RLS:
--   Admin full access (user_profiles.role = 'admin')
--   Public read (SELECT) for client portal aggregation
