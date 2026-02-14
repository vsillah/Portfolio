-- ============================================================================
-- Migration: Meeting Action Tasks + Client Update Drafts
-- Date: 2026-02-14
-- Purpose: Promote meeting_records.action_items into first-class tracked tasks,
--          and store draft client-update emails that aggregate completed tasks.
-- Dependencies: meeting_records, client_projects tables
-- ============================================================================

-- ============================================================================
-- 1. meeting_action_tasks — one row per action item from a meeting
-- ============================================================================

CREATE TABLE IF NOT EXISTS meeting_action_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origin: which meeting this action came from
  meeting_record_id UUID NOT NULL REFERENCES meeting_records(id) ON DELETE CASCADE,

  -- Project context (denormalized for easier queries; nullable if meeting has no project)
  client_project_id UUID REFERENCES client_projects(id) ON DELETE SET NULL,

  -- Task content
  title TEXT NOT NULL,
  description TEXT,
  owner TEXT,                       -- assignee name or email
  due_date DATE,

  -- Status lifecycle: pending → in_progress → complete | cancelled
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'complete', 'cancelled')),

  -- Completion tracking
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Ordering within a meeting's task list
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Optional external tool sync (Jira key, Linear id, Slack message ts, etc.)
  external_id TEXT,

  -- Slack channel where this task message lives (for sync / status updates)
  slack_message_ts TEXT,
  slack_channel_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mat_meeting_record
  ON meeting_action_tasks(meeting_record_id);

CREATE INDEX IF NOT EXISTS idx_mat_client_project
  ON meeting_action_tasks(client_project_id)
  WHERE client_project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mat_status
  ON meeting_action_tasks(status);

CREATE INDEX IF NOT EXISTS idx_mat_due_date
  ON meeting_action_tasks(due_date)
  WHERE due_date IS NOT NULL AND status IN ('pending', 'in_progress');

-- RLS — admin-only via service role; authenticated users can read
ALTER TABLE meeting_action_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON meeting_action_tasks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON meeting_action_tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON meeting_action_tasks
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_meeting_action_tasks_updated_at
  BEFORE UPDATE ON meeting_action_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grants
GRANT ALL ON meeting_action_tasks TO authenticated;
GRANT ALL ON meeting_action_tasks TO service_role;

COMMENT ON TABLE meeting_action_tasks IS
  'First-class action items promoted from meeting_records.action_items. Tracked as tasks between meetings with Slack Kanban visibility.';

-- ============================================================================
-- 2. client_update_drafts — draft emails generated from completed tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_update_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which project and (optionally) which meeting drove this update
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  meeting_record_id UUID REFERENCES meeting_records(id) ON DELETE SET NULL,

  -- Email content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_name TEXT NOT NULL,

  -- Which completed tasks are summarised in this draft
  task_ids UUID[] DEFAULT '{}',

  -- Status: draft → sent
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent')),

  -- Delivery tracking
  sent_at TIMESTAMPTZ,
  sent_via TEXT CHECK (sent_via IN ('email', 'slack', NULL)),

  -- Who created / sent
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cud_client_project
  ON client_update_drafts(client_project_id);

CREATE INDEX IF NOT EXISTS idx_cud_status
  ON client_update_drafts(status);

CREATE INDEX IF NOT EXISTS idx_cud_meeting_record
  ON client_update_drafts(meeting_record_id)
  WHERE meeting_record_id IS NOT NULL;

-- RLS
ALTER TABLE client_update_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON client_update_drafts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON client_update_drafts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON client_update_drafts
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_client_update_drafts_updated_at
  BEFORE UPDATE ON client_update_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grants
GRANT ALL ON client_update_drafts TO authenticated;
GRANT ALL ON client_update_drafts TO service_role;

COMMENT ON TABLE client_update_drafts IS
  'Draft client-update emails generated from completed meeting_action_tasks. Tracked in-app so drafts are not lost; sent via n8n when approved.';
