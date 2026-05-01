-- ============================================================================
-- Client AI Ops Roadmap
-- Date: 2026-05-01
-- Purpose: Sales-to-delivery roadmap phases, tasks, costs, reports, and
--          transparent task projection into client dashboards and meeting tasks.
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_ai_ops_roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID REFERENCES client_projects(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Client AI Ops Roadmap',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'proposed', 'approved', 'active', 'completed', 'paused', 'cancelled')),
  generated_from TEXT NOT NULL DEFAULT 'manual'
    CHECK (generated_from IN ('manual', 'sales', 'proposal_acceptance', 'monitoring', 'import')),
  client_summary TEXT,
  admin_notes TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_ai_ops_roadmaps_scope_check CHECK (
    client_project_id IS NOT NULL OR proposal_id IS NOT NULL OR contact_submission_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS client_ai_ops_roadmap_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES client_ai_ops_roadmaps(id) ON DELETE CASCADE,
  phase_key TEXT NOT NULL,
  phase_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'complete', 'blocked', 'skipped', 'cancelled')),
  target_start_date DATE,
  target_end_date DATE,
  completed_at TIMESTAMPTZ,
  acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_amadutown_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_amadutown_cost >= 0),
  estimated_client_startup_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_client_startup_cost >= 0),
  estimated_monthly_operating_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_monthly_operating_cost >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (roadmap_id, phase_key)
);

CREATE TABLE IF NOT EXISTS client_ai_ops_roadmap_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES client_ai_ops_roadmaps(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES client_ai_ops_roadmap_phases(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_type TEXT NOT NULL DEFAULT 'amadutown'
    CHECK (owner_type IN ('client', 'amadutown', 'shared')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'complete', 'blocked', 'cancelled')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  client_visible BOOLEAN NOT NULL DEFAULT true,
  meeting_task_visible BOOLEAN NOT NULL DEFAULT true,
  cost_category TEXT,
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  dependency_notes TEXT,
  acceptance_criteria TEXT,
  dashboard_task_id UUID REFERENCES dashboard_tasks(id) ON DELETE SET NULL,
  meeting_action_task_id UUID REFERENCES meeting_action_tasks(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (roadmap_id, task_key)
);

CREATE TABLE IF NOT EXISTS client_ai_ops_roadmap_cost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES client_ai_ops_roadmaps(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES client_ai_ops_roadmap_phases(id) ON DELETE SET NULL,
  task_id UUID REFERENCES client_ai_ops_roadmap_tasks(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN (
    'hardware', 'saas', 'access_security', 'ai_runtime', 'automation',
    'monitoring', 'backup', 'implementation_labor', 'optional_upgrade', 'other'
  )),
  label TEXT NOT NULL,
  description TEXT,
  payer TEXT NOT NULL DEFAULT 'client' CHECK (payer IN ('client', 'amadutown', 'shared')),
  cost_type TEXT NOT NULL DEFAULT 'one_time' CHECK (cost_type IN ('one_time', 'monthly', 'usage_based', 'quote_required')),
  amount NUMERIC(12,2) CHECK (amount IS NULL OR amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  source_url TEXT,
  pricing_state TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (pricing_state IN ('fresh', 'needs_review', 'stale', 'quote_required', 'source_unavailable')),
  last_checked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_ai_ops_roadmap_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES client_ai_ops_roadmaps(id) ON DELETE CASCADE,
  client_project_id UUID REFERENCES client_projects(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('phase_summary', 'monthly_summary', 'monitoring_summary', 'upgrade_recommendation')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sent', 'archived')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  client_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  amadutown_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_needed JSONB NOT NULL DEFAULT '[]'::jsonb,
  monitoring_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  cost_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_ai_ops_technology_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'hardware', 'access_networking', 'credential_vault', 'identity_mdm',
    'automation', 'ai_runtime', 'vector_database', 'monitoring', 'backup', 'other'
  )),
  best_fit TEXT,
  avoid_when TEXT,
  source_url TEXT,
  pricing_model TEXT NOT NULL DEFAULT 'unknown' CHECK (pricing_model IN ('one_time', 'monthly', 'per_user', 'usage_based', 'quote_required', 'unknown')),
  setup_complexity TEXT NOT NULL DEFAULT 'medium' CHECK (setup_complexity IN ('low', 'medium', 'high')),
  integration_complexity TEXT NOT NULL DEFAULT 'medium' CHECK (integration_complexity IN ('low', 'medium', 'high')),
  data_ownership_fit TEXT NOT NULL DEFAULT 'hybrid' CHECK (data_ownership_fit IN ('local', 'hybrid', 'cloud')),
  monitoring_support TEXT NOT NULL DEFAULT 'medium' CHECK (monitoring_support IN ('low', 'medium', 'high')),
  security_notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor, product_name)
);

CREATE TABLE IF NOT EXISTS client_ai_ops_technology_price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technology_option_id UUID NOT NULL REFERENCES client_ai_ops_technology_options(id) ON DELETE CASCADE,
  pricing_state TEXT NOT NULL CHECK (pricing_state IN ('fresh', 'needs_review', 'stale', 'quote_required', 'source_unavailable')),
  amount_low NUMERIC(12,2) CHECK (amount_low IS NULL OR amount_low >= 0),
  amount_high NUMERIC(12,2) CHECK (amount_high IS NULL OR amount_high >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_period TEXT CHECK (billing_period IN ('one_time', 'monthly', 'annual', 'usage_based', 'quote_required', NULL)),
  source_url TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS implementation_roadmap_snapshot JSONB;

ALTER TABLE dashboard_tasks
  ADD COLUMN IF NOT EXISTS roadmap_task_id UUID REFERENCES client_ai_ops_roadmap_tasks(id) ON DELETE SET NULL;

ALTER TABLE meeting_action_tasks
  ADD COLUMN IF NOT EXISTS roadmap_task_id UUID REFERENCES client_ai_ops_roadmap_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_roadmaps_project
  ON client_ai_ops_roadmaps(client_project_id);

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_roadmaps_proposal
  ON client_ai_ops_roadmaps(proposal_id);

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_roadmaps_status
  ON client_ai_ops_roadmaps(status);

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_phases_roadmap_order
  ON client_ai_ops_roadmap_phases(roadmap_id, phase_order);

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_tasks_roadmap_status
  ON client_ai_ops_roadmap_tasks(roadmap_id, status);

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_tasks_phase
  ON client_ai_ops_roadmap_tasks(phase_id);

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_tasks_due
  ON client_ai_ops_roadmap_tasks(due_date)
  WHERE due_date IS NOT NULL AND status IN ('pending', 'in_progress', 'blocked');

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_costs_roadmap
  ON client_ai_ops_roadmap_cost_items(roadmap_id);

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_reports_roadmap
  ON client_ai_ops_roadmap_reports(roadmap_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_tech_options_category
  ON client_ai_ops_technology_options(category, active);

CREATE INDEX IF NOT EXISTS idx_client_ai_ops_price_snapshots_option
  ON client_ai_ops_technology_price_snapshots(technology_option_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_roadmap_task
  ON dashboard_tasks(roadmap_task_id)
  WHERE roadmap_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_action_tasks_roadmap_task
  ON meeting_action_tasks(roadmap_task_id)
  WHERE roadmap_task_id IS NOT NULL;

ALTER TABLE client_ai_ops_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ai_ops_roadmap_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ai_ops_roadmap_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ai_ops_roadmap_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ai_ops_roadmap_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ai_ops_technology_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ai_ops_technology_price_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client_ai_ops_roadmaps"
  ON client_ai_ops_roadmaps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage client_ai_ops_roadmap_phases"
  ON client_ai_ops_roadmap_phases FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage client_ai_ops_roadmap_tasks"
  ON client_ai_ops_roadmap_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage client_ai_ops_roadmap_cost_items"
  ON client_ai_ops_roadmap_cost_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage client_ai_ops_roadmap_reports"
  ON client_ai_ops_roadmap_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage client_ai_ops_technology_options"
  ON client_ai_ops_technology_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage client_ai_ops_technology_price_snapshots"
  ON client_ai_ops_technology_price_snapshots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT ALL ON client_ai_ops_roadmaps TO authenticated, service_role;
GRANT ALL ON client_ai_ops_roadmap_phases TO authenticated, service_role;
GRANT ALL ON client_ai_ops_roadmap_tasks TO authenticated, service_role;
GRANT ALL ON client_ai_ops_roadmap_cost_items TO authenticated, service_role;
GRANT ALL ON client_ai_ops_roadmap_reports TO authenticated, service_role;
GRANT ALL ON client_ai_ops_technology_options TO authenticated, service_role;
GRANT ALL ON client_ai_ops_technology_price_snapshots TO authenticated, service_role;

COMMENT ON TABLE client_ai_ops_roadmaps IS 'Client-owned AI Ops implementation roadmap across sales, delivery, monitoring, reporting, and upgrades.';
COMMENT ON COLUMN proposals.implementation_roadmap_snapshot IS 'Immutable proposal-time snapshot of roadmap phases, tasks, costs, and assumptions.';
COMMENT ON COLUMN dashboard_tasks.roadmap_task_id IS 'Links client-visible dashboard task projection back to its source AI Ops roadmap task.';
COMMENT ON COLUMN meeting_action_tasks.roadmap_task_id IS 'Links admin meeting task projection back to its source AI Ops roadmap task.';
COMMENT ON TABLE client_ai_ops_technology_options IS 'Technology registry used by sales roadmap recommendations, pricing freshness, and bake-off upgrade reviews.';
COMMENT ON TABLE client_ai_ops_technology_price_snapshots IS 'Dated pricing/source checks for AI Ops technology options.';
