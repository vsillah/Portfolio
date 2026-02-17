-- Migration: Client Dashboard Tables
-- Creates 4 tables for the client-facing assessment dashboard:
--   1. client_dashboard_access  - Token-based access control
--   2. dashboard_tasks          - Client-completable tasks with DIY/accelerated paths
--   3. score_snapshots          - Score history for trajectory visualization
--   4. acceleration_recommendations - Personalized service recommendations

-- ============================================================================
-- 1. client_dashboard_access
-- Secure token-based access (same pattern as proposals but with explicit tokens)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_dashboard_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_access_token
  ON client_dashboard_access(access_token);

CREATE INDEX IF NOT EXISTS idx_dashboard_access_project
  ON client_dashboard_access(client_project_id);

-- RLS
ALTER TABLE client_dashboard_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read dashboard access by token"
  ON client_dashboard_access FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage dashboard access"
  ON client_dashboard_access FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 2. dashboard_tasks
-- Client-completable tasks derived from assessment, with DIY resources and
-- accelerated path (bundle/service) for each task
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  impact_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'complete')),
  completed_at TIMESTAMPTZ,
  due_date DATE,
  display_order INTEGER DEFAULT 0,

  -- DIY path: resources the client can use to complete this task themselves
  -- Each element: { type, title, url, content_type, content_id, description,
  --                  estimated_time, file_bucket, file_path }
  diy_resources JSONB DEFAULT '[]'::jsonb,

  -- Accelerated path: the bundle/service that accomplishes this task faster
  accelerated_bundle_id UUID REFERENCES offer_bundles(id) ON DELETE SET NULL,
  accelerated_service_id BIGINT,
  accelerated_headline TEXT,
  accelerated_savings TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_project
  ON dashboard_tasks(client_project_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_status
  ON dashboard_tasks(status);

CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_project_order
  ON dashboard_tasks(client_project_id, display_order);

-- RLS
ALTER TABLE dashboard_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read dashboard tasks"
  ON dashboard_tasks FOR SELECT
  USING (true);

CREATE POLICY "Public can update dashboard task status"
  ON dashboard_tasks FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can manage dashboard tasks"
  ON dashboard_tasks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 3. score_snapshots
-- Track assessment score changes over time for trajectory visualization
-- ============================================================================

CREATE TABLE IF NOT EXISTS score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  snapshot_date TIMESTAMPTZ DEFAULT now(),
  category_scores JSONB NOT NULL,
  overall_score INTEGER NOT NULL,
  dream_outcome_gap NUMERIC,
  trigger TEXT NOT NULL CHECK (trigger IN ('initial', 'task_completed', 'milestone_achieved', 'manual')),
  trigger_ref UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_project
  ON score_snapshots(client_project_id);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_project_date
  ON score_snapshots(client_project_id, snapshot_date DESC);

-- RLS
ALTER TABLE score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read score snapshots"
  ON score_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage score snapshots"
  ON score_snapshots FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 4. acceleration_recommendations
-- Personalized service recommendations tied to client gaps, powered by
-- the value evidence pipeline (pain_point_categories, industry_benchmarks,
-- value_calculations, content_pain_point_map)
-- ============================================================================

CREATE TABLE IF NOT EXISTS acceleration_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  pain_point_category_id UUID REFERENCES pain_point_categories(id) ON DELETE SET NULL,

  -- What service/product we recommend
  content_type TEXT NOT NULL,
  content_id BIGINT NOT NULL,
  service_title TEXT NOT NULL,

  -- The gap it addresses
  gap_category TEXT NOT NULL,
  gap_description TEXT,

  -- Projected impact
  projected_impact_pct NUMERIC,
  projected_annual_value NUMERIC,
  impact_headline TEXT,
  impact_explanation TEXT,

  -- Data source transparency
  data_source TEXT NOT NULL CHECK (data_source IN ('industry_benchmark', 'client_specific', 'blended')),
  benchmark_ids UUID[],
  value_calculation_id UUID REFERENCES value_calculations(id) ON DELETE SET NULL,
  confidence_level TEXT DEFAULT 'medium' CHECK (confidence_level IN ('high', 'medium', 'low')),

  -- Presentation
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- CTA
  cta_type TEXT DEFAULT 'learn_more' CHECK (cta_type IN ('learn_more', 'book_call', 'view_proposal', 'start_trial')),
  cta_url TEXT,

  -- Lifecycle
  dismissed_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accel_recs_project
  ON acceleration_recommendations(client_project_id);

CREATE INDEX IF NOT EXISTS idx_accel_recs_active
  ON acceleration_recommendations(client_project_id, is_active)
  WHERE is_active = true AND dismissed_at IS NULL;

-- RLS
ALTER TABLE acceleration_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read acceleration recommendations"
  ON acceleration_recommendations FOR SELECT
  USING (true);

CREATE POLICY "Public can update acceleration recommendations"
  ON acceleration_recommendations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can manage acceleration recommendations"
  ON acceleration_recommendations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_accel_recs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_accel_recs_updated_at
  BEFORE UPDATE ON acceleration_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_accel_recs_updated_at();
