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
    'payment_received',      -- Stripe payment confirmed
    'onboarding_scheduled',  -- Onboarding call booked (pre-kickoff orientation)
    'kickoff_scheduled',     -- Kickoff call booked
    'active',                -- Project in progress
    'testing',               -- E2E testing phase
    'delivering',            -- Delivering final assets
    'complete',              -- Project delivered
    'archived'               -- Archived/closed
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

  -- Calendly (per-meeting-type tracking)
  calendly_event_uri TEXT,                -- Legacy/backward-compat field
  onboarding_calendly_uri TEXT,           -- Onboarding call Calendly event URI
  onboarding_completed_at TIMESTAMPTZ,    -- When onboarding call was completed
  kickoff_calendly_uri TEXT,              -- Kickoff meeting Calendly event URI
  progress_calendly_uri TEXT,             -- Progress check-in Calendly event URI
  go_no_go_calendly_uri TEXT,             -- Go/No-Go review Calendly event URI
  delivery_calendly_uri TEXT,             -- Delivery & Review Calendly event URI
  go_no_go_completed_at TIMESTAMPTZ,      -- When Go/No-Go review was completed
  delivery_review_completed_at TIMESTAMPTZ, -- When Delivery & Review was completed

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

-- ============================================================
-- Meeting Intelligence Pipeline: meeting_records table
-- Stores structured notes, decisions, action items, and
-- AI-extracted data from every client meeting across the
-- 6-stage lifecycle (discovery through delivery).
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID REFERENCES client_projects(id) ON DELETE CASCADE,

  -- Meeting identification
  meeting_type TEXT NOT NULL CHECK (meeting_type IN (
    'discovery', 'onboarding', 'kickoff',
    'progress_checkin', 'go_no_go', 'delivery_review'
  )),
  calendly_event_uri TEXT,

  -- Raw capture
  transcript TEXT,           -- Full transcript (from Read.ai or manual)
  raw_notes TEXT,            -- Unstructured notes
  recording_url TEXT,        -- Meeting recording link

  -- AI-structured outcomes (JSONB for flexibility per meeting type)
  structured_notes JSONB DEFAULT '{}',
  key_decisions JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  open_questions JSONB DEFAULT '[]',
  risks_identified JSONB DEFAULT '[]',

  -- Meeting-type-specific structured data (shapes documented below)
  meeting_data JSONB DEFAULT '{}',

  -- Agenda that was used for THIS meeting
  agenda_used JSONB DEFAULT '[]',

  -- Next meeting prep (generated by AI Agenda Builder)
  next_meeting_type TEXT,
  next_meeting_agenda JSONB DEFAULT '[]',
  next_meeting_brief TEXT,

  -- Metadata
  meeting_date TIMESTAMPTZ,
  duration_minutes INTEGER,
  attendees JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for meeting_records
CREATE INDEX IF NOT EXISTS idx_meeting_records_client_project
ON meeting_records(client_project_id);

CREATE INDEX IF NOT EXISTS idx_meeting_records_meeting_type
ON meeting_records(meeting_type);

CREATE INDEX IF NOT EXISTS idx_meeting_records_meeting_date
ON meeting_records(meeting_date DESC);

-- Comments for meeting_records
COMMENT ON TABLE meeting_records IS 'Stores structured meeting notes, decisions, action items, and AI-extracted data for every client meeting across the 6-stage lifecycle.';
COMMENT ON COLUMN meeting_records.meeting_type IS 'One of: discovery, onboarding, kickoff, progress_checkin, go_no_go, delivery_review';
COMMENT ON COLUMN meeting_records.transcript IS 'Full meeting transcript from Read.ai or manual entry';
COMMENT ON COLUMN meeting_records.raw_notes IS 'Unstructured meeting notes (before AI processing)';
COMMENT ON COLUMN meeting_records.structured_notes IS 'AI-structured summary of the meeting';
COMMENT ON COLUMN meeting_records.key_decisions IS 'JSON array of decisions made during the meeting';
COMMENT ON COLUMN meeting_records.action_items IS 'JSON array of action items: [{action, owner, due_date, status}]';
COMMENT ON COLUMN meeting_records.open_questions IS 'JSON array of unresolved questions from the meeting';
COMMENT ON COLUMN meeting_records.risks_identified IS 'JSON array of risks identified: [{risk, likelihood, impact, mitigation}]';
COMMENT ON COLUMN meeting_records.meeting_data IS 'Meeting-type-specific structured data (JSONB). Shape varies by meeting_type -- see schema docs.';
COMMENT ON COLUMN meeting_records.agenda_used IS 'The agenda items that were used for this meeting (copied from meeting_agenda_items at meeting time)';
COMMENT ON COLUMN meeting_records.next_meeting_type IS 'The type of the next meeting in the lifecycle';
COMMENT ON COLUMN meeting_records.next_meeting_agenda IS 'AI-generated agenda items for the next meeting';
COMMENT ON COLUMN meeting_records.next_meeting_brief IS 'AI-generated narrative brief for the next meeting (suitable for email)';

-- ============================================================
-- meeting_data JSONB shapes by meeting_type:
--
-- discovery:
--   pain_points_discussed: string[]
--   solutions_proposed: string[]
--   timeline_preference: string
--   budget_confirmed: string
--   decision_makers: string[]
--   competitor_mentions: string[]
--   fit_assessment: string (hot/warm/cold)
--
-- onboarding:
--   tools_agreed: [{name, purpose, access_type, owner}]
--   access_requirements: [{platform, credential_type, status}]
--   communication_plan: {channel, cadence, escalation_path}
--   timeline_confirmed: {start_date, end_date, milestones[]}
--   win_conditions: string[]
--   client_questions: string[]
--   artifact_handoff: {format, delivery_method, review_process}
--
-- kickoff:
--   access_granted: [{platform, status, notes}]
--   access_pending: [{platform, blocker, owner, due_date}]
--   milestone_dates_confirmed: [{phase, description, target_date}]
--   roles_assigned: [{person, role, responsibilities}]
--   risks_identified: [{risk, likelihood, impact, mitigation}]
--   communication_confirmed: {slack_channel, meeting_cadence, update_format}
--
-- progress_checkin:
--   milestone_status: [{milestone, status, notes}]
--   blockers_reviewed: [{blocker_id, status, resolution}]
--   scope_changes: string[]
--   client_satisfaction: string
--   next_actions: [{action, owner, due_date}]
--
-- go_no_go:
--   test_results: [{test_case, result, notes}]
--   approval_status: string (approved/conditional/rejected)
--   punch_list: [{item, severity, owner, due_date}]
--   launch_conditions: string[]
--   conditional_items: string[]
--
-- delivery_review:
--   deliverables_reviewed: [{deliverable, status, feedback}]
--   client_feedback: string
--   satisfaction_score: number (1-10)
--   training_gaps: string[]
--   upsell_opportunities: string[]
--   testimonial_consent: boolean
-- ============================================================

-- ============================================================
-- Meeting Intelligence Pipeline: meeting_agenda_items table
-- Stores individual agenda items for upcoming meetings,
-- with source tracing back to prior meeting data.
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_record_id UUID REFERENCES meeting_records(id) ON DELETE CASCADE,

  -- Agenda item details
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN (
    'review', 'decision', 'discussion', 'action', 'info'
  )),
  priority INTEGER DEFAULT 0,
  estimated_minutes INTEGER,

  -- Traceability: where did this agenda item come from?
  source_meeting_id UUID REFERENCES meeting_records(id),
  source_field TEXT,    -- e.g. 'action_items[2]', 'open_questions[0]'
  source_table TEXT,    -- e.g. 'diagnostic_audits', 'contact_submissions', 'project_blockers'
  source_id TEXT,       -- ID in the source table

  -- Outcome (filled after meeting)
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'discussed', 'resolved', 'deferred', 'dropped'
  )),
  outcome_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for meeting_agenda_items
CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_meeting_record
ON meeting_agenda_items(meeting_record_id);

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_status
ON meeting_agenda_items(status)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_source_meeting
ON meeting_agenda_items(source_meeting_id)
WHERE source_meeting_id IS NOT NULL;

-- Comments for meeting_agenda_items
COMMENT ON TABLE meeting_agenda_items IS 'Individual agenda items for upcoming meetings, with source tracing back to prior meeting data and outcomes tracking.';
COMMENT ON COLUMN meeting_agenda_items.category IS 'Type of agenda item: review, decision, discussion, action, info';
COMMENT ON COLUMN meeting_agenda_items.source_meeting_id IS 'Reference to the meeting_record that generated this agenda item';
COMMENT ON COLUMN meeting_agenda_items.source_field IS 'Specific field in the source record, e.g. action_items[2], open_questions[0]';
COMMENT ON COLUMN meeting_agenda_items.source_table IS 'Source table if not from a meeting_record, e.g. diagnostic_audits, contact_submissions';
COMMENT ON COLUMN meeting_agenda_items.source_id IS 'ID in the source table';
COMMENT ON COLUMN meeting_agenda_items.status IS 'Outcome after meeting: pending, discussed, resolved, deferred, dropped';
