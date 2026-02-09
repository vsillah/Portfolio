-- ============================================================================
-- Client Projects & Milestone Reminders - Database Schema
-- Run this SQL in Supabase SQL Editor
-- Required by WF-006: Milestone Planning workflow
-- ============================================================================

-- ============================================================================
-- 1. Client Projects - Active project tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Project info
  project_name TEXT NOT NULL,
  description TEXT,

  -- Client info
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,

  -- Linked contact (optional - if the client came through the lead pipeline)
  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,

  -- Timeline
  project_start_date DATE NOT NULL,
  estimated_end_date DATE NOT NULL,
  actual_end_date DATE,

  -- Status: active, completed, paused, cancelled
  project_status TEXT NOT NULL DEFAULT 'active'
    CHECK (project_status IN ('active', 'completed', 'paused', 'cancelled')),

  -- Current phase tracking (4-phase model used by WF-006)
  -- Phase 1: Setup & Access
  -- Phase 2: Build & Customize
  -- Phase 3: Test E2E
  -- Phase 4: Deliver & Document
  current_phase INTEGER DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 4),

  -- Budget & billing
  project_value NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',

  -- Communication
  slack_channel TEXT,              -- Slack channel ID for milestone reminders (e.g. C06XXXXXXX)

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_projects_status
ON client_projects(project_status);

CREATE INDEX IF NOT EXISTS idx_client_projects_active
ON client_projects(project_status, estimated_end_date)
WHERE project_status = 'active';

CREATE INDEX IF NOT EXISTS idx_client_projects_client_email
ON client_projects(client_email);

CREATE INDEX IF NOT EXISTS idx_client_projects_contact
ON client_projects(contact_submission_id)
WHERE contact_submission_id IS NOT NULL;

-- Comments
COMMENT ON TABLE client_projects IS 'Client project tracking for milestone planning (WF-006). Tracks timeline, phases, and delivery status.';
COMMENT ON COLUMN client_projects.project_status IS 'Project lifecycle status: active, completed, paused, cancelled';
COMMENT ON COLUMN client_projects.current_phase IS 'Current project phase (1-4): Setup, Build, Test, Deliver';
COMMENT ON COLUMN client_projects.slack_channel IS 'Slack channel ID for sending milestone reminder notifications';

-- ============================================================================
-- 2. Project Reminders - Audit log for milestone notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to project
  project_id UUID REFERENCES client_projects(id) ON DELETE CASCADE,

  -- Reminder details
  client_email TEXT,
  reminder_type TEXT NOT NULL DEFAULT 'milestone'
    CHECK (reminder_type IN ('milestone', 'deadline', 'kickoff', 'review', 'delivery', 'manual')),
  current_phase TEXT,
  message TEXT,

  -- Delivery tracking
  channel TEXT DEFAULT 'slack' CHECK (channel IN ('slack', 'email', 'both')),
  delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_reminders_project
ON project_reminders(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_reminders_type
ON project_reminders(reminder_type, created_at DESC);

-- Comments
COMMENT ON TABLE project_reminders IS 'Audit log for project milestone reminders sent by WF-006';
COMMENT ON COLUMN project_reminders.reminder_type IS 'Type of reminder: milestone, deadline, kickoff, review, delivery, manual';
COMMENT ON COLUMN project_reminders.current_phase IS 'Phase at the time the reminder was sent';

-- ============================================================================
-- 3. Enable Row Level Security
-- ============================================================================
ALTER TABLE client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_reminders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS Policies - Admin only
-- ============================================================================

-- Client Projects - Admin only
DROP POLICY IF EXISTS "Admins can manage client projects" ON client_projects;
CREATE POLICY "Admins can manage client projects"
  ON client_projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Project Reminders - Admin only
DROP POLICY IF EXISTS "Admins can manage project reminders" ON project_reminders;
CREATE POLICY "Admins can manage project reminders"
  ON project_reminders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 5. Service role access (for n8n API calls)
-- ============================================================================

-- Allow the service role (used by n8n via Supabase API) full access
GRANT ALL ON client_projects TO service_role;
GRANT ALL ON project_reminders TO service_role;

-- Also grant to authenticated users (admin dashboard)
GRANT ALL ON client_projects TO authenticated;
GRANT ALL ON project_reminders TO authenticated;

-- ============================================================================
-- 6. Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_client_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_projects_updated_at ON client_projects;
CREATE TRIGGER client_projects_updated_at
  BEFORE UPDATE ON client_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_client_projects_updated_at();

-- ============================================================================
-- 7. Helpful views
-- ============================================================================

-- View: Active projects with milestone progress
CREATE OR REPLACE VIEW active_project_milestones AS
SELECT
  cp.id,
  cp.project_name,
  cp.client_name,
  cp.client_email,
  cp.project_start_date,
  cp.estimated_end_date,
  cp.current_phase,
  cp.slack_channel,
  cp.project_value,
  (cp.estimated_end_date - CURRENT_DATE) AS days_until_delivery,
  ROUND(
    (CURRENT_DATE - cp.project_start_date)::NUMERIC /
    NULLIF((cp.estimated_end_date - cp.project_start_date)::NUMERIC, 0) * 100
  ) AS progress_percent,
  (SELECT COUNT(*) FROM project_reminders pr WHERE pr.project_id = cp.id) AS reminders_sent,
  (SELECT MAX(pr.created_at) FROM project_reminders pr WHERE pr.project_id = cp.id) AS last_reminder_at
FROM client_projects cp
WHERE cp.project_status = 'active'
ORDER BY cp.estimated_end_date ASC;

COMMENT ON VIEW active_project_milestones IS 'Active projects with calculated progress and reminder history';
