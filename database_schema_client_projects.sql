-- ============================================================================
-- Client Projects Schema
-- Replaces Google Sheets "AmaduTown N8N Client Tracking Sheet"
-- Links to sales_sessions, proposals, and contact_submissions
-- ============================================================================

-- Client Projects table - tracks active project lifecycle
CREATE TABLE IF NOT EXISTS client_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to existing Supabase tables
  sales_session_id UUID REFERENCES sales_sessions(id) ON DELETE SET NULL,
  proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,

  -- Client identity
  client_id TEXT NOT NULL,  -- e.g. cli_20260201_1
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_company TEXT,

  -- Communication
  slack_channel TEXT,

  -- Project lifecycle
  project_status TEXT NOT NULL DEFAULT 'payment_received' CHECK (project_status IN (
    'payment_received',   -- Stripe payment confirmed
    'kickoff_scheduled',  -- Kickoff call booked
    'active',             -- Project in progress
    'testing',            -- E2E testing phase
    'delivering',         -- Delivering final assets
    'complete',           -- Project delivered
    'archived'            -- Archived/closed
  )),
  current_phase INTEGER DEFAULT 0 CHECK (current_phase BETWEEN 0 AND 4),
  -- Phase 0: Pre-kickoff
  -- Phase 1: Setup & Access
  -- Phase 2: Build & Customize
  -- Phase 3: Test E2E
  -- Phase 4: Deliver & Document

  -- Timeline
  kickoff_scheduled TIMESTAMPTZ,
  kickoff_completed_at TIMESTAMPTZ,
  project_start_date TIMESTAMPTZ,
  estimated_end_date TIMESTAMPTZ,
  milestones TEXT,

  -- Deliverables & docs
  project_folder_url TEXT,
  sop_document_url TEXT,
  video_url TEXT,
  e2e_testing_doc TEXT,

  -- Setup timestamps
  workspace_setup_at TIMESTAMPTZ,
  documentation_created_at TIMESTAMPTZ,
  e2e_testing_started TIMESTAMPTZ,

  -- Payment / Stripe
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  payment_amount DECIMAL(10, 2),
  payment_currency TEXT DEFAULT 'USD',
  product_purchased TEXT,

  -- Calendly
  calendly_event_uri TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Project Reminders table (replaces "Reminders" sheet tab)
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID REFERENCES client_projects(id) ON DELETE CASCADE,
  client_email TEXT NOT NULL,
  reminder_type TEXT NOT NULL,  -- 'milestone', 'progress_update', 'follow_up'
  phase INTEGER,
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Project Blockers table (replaces "Blockers" sheet tab)
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID REFERENCES client_projects(id) ON DELETE CASCADE,
  channel TEXT,
  slack_user TEXT,
  message TEXT,
  urgency TEXT DEFAULT 'high' CHECK (urgency IN ('critical', 'high', 'normal')),
  keywords TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved'))
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_client_projects_email ON client_projects(client_email);
CREATE INDEX IF NOT EXISTS idx_client_projects_status ON client_projects(project_status);
CREATE INDEX IF NOT EXISTS idx_client_projects_active ON client_projects(project_status) WHERE project_status = 'active';
CREATE INDEX IF NOT EXISTS idx_client_projects_sales_session ON client_projects(sales_session_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_proposal ON client_projects(proposal_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_stripe ON client_projects(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_client_id ON client_projects(client_id);

CREATE INDEX IF NOT EXISTS idx_project_reminders_project ON project_reminders(client_project_id);
CREATE INDEX IF NOT EXISTS idx_project_reminders_email ON project_reminders(client_email);

CREATE INDEX IF NOT EXISTS idx_project_blockers_project ON project_blockers(client_project_id);
CREATE INDEX IF NOT EXISTS idx_project_blockers_status ON project_blockers(status) WHERE status = 'open';

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_blockers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies - Admin only
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage client projects" ON client_projects;
CREATE POLICY "Admins can manage client projects"
  ON client_projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage project reminders" ON project_reminders;
CREATE POLICY "Admins can manage project reminders"
  ON project_reminders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage project blockers" ON project_blockers;
CREATE POLICY "Admins can manage project blockers"
  ON project_blockers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- Trigger for updated_at
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
-- Useful views
-- ============================================================================

-- Active projects with full context
CREATE OR REPLACE VIEW active_client_projects AS
SELECT
  cp.*,
  ss.funnel_stage,
  ss.client_responses,
  ss.internal_notes as sales_notes,
  ss.outcome as sales_outcome,
  p.total_amount as proposal_amount,
  p.status as proposal_status
FROM client_projects cp
LEFT JOIN sales_sessions ss ON cp.sales_session_id = ss.id
LEFT JOIN proposals p ON cp.proposal_id = p.id
WHERE cp.project_status IN ('active', 'testing', 'delivering');

-- Project summary for dashboards
CREATE OR REPLACE VIEW client_project_summary AS
SELECT
  cp.id,
  cp.client_id,
  cp.client_name,
  cp.client_email,
  cp.client_company,
  cp.slack_channel,
  cp.project_status,
  cp.current_phase,
  cp.project_start_date,
  cp.estimated_end_date,
  cp.payment_amount,
  cp.product_purchased,
  (SELECT COUNT(*) FROM project_blockers pb WHERE pb.client_project_id = cp.id AND pb.status = 'open') as open_blockers,
  (SELECT COUNT(*) FROM project_reminders pr WHERE pr.client_project_id = cp.id) as total_reminders,
  cp.created_at,
  cp.updated_at
FROM client_projects cp
ORDER BY cp.created_at DESC;
