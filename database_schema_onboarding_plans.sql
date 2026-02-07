-- ============================================================================
-- Onboarding Plan Templates & Generated Plans Schema
-- Templatized client onboarding plans that are dynamically populated
-- based on the nature of the product/service purchased.
-- ============================================================================

-- ============================================================================
-- Onboarding Plan Templates table
-- Template definitions keyed by content_type + service_type.
-- Each template contains JSONB for the 6 onboarding sections
-- with placeholder tokens (e.g., {{client_name}}, {{project_start_date}}).
-- ============================================================================
CREATE TABLE IF NOT EXISTS onboarding_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  
  -- Template matching criteria
  content_type TEXT NOT NULL CHECK (content_type IN (
    'product', 'project', 'video', 'publication', 'music',
    'lead_magnet', 'prototype', 'service'
  )),
  service_type TEXT CHECK (service_type IS NULL OR service_type IN (
    'training', 'speaking', 'consulting', 'coaching', 'workshop'
  )),
  offer_role TEXT CHECK (offer_role IS NULL OR offer_role IN (
    'core_offer', 'bonus', 'upsell', 'downsell',
    'continuity', 'lead_magnet', 'decoy', 'anchor'
  )),
  
  -- Template sections (JSONB with dynamic tokens)
  -- setup_requirements: [{title, description, category, is_client_action}]
  setup_requirements JSONB NOT NULL DEFAULT '[]',
  
  -- milestones_template: [{week, title, description, deliverables[], phase}]
  milestones_template JSONB NOT NULL DEFAULT '[]',
  
  -- communication_plan: {cadence, channels[], meetings[{type, frequency, duration_minutes}], escalation_path}
  communication_plan JSONB NOT NULL DEFAULT '{}',
  
  -- win_conditions: [{metric, target, measurement_method, timeframe}]
  win_conditions JSONB NOT NULL DEFAULT '[]',
  
  -- warranty: {duration_months, coverage_description, exclusions[], extended_support_available, extended_support_description}
  warranty JSONB NOT NULL DEFAULT '{}',
  
  -- artifacts_handoff: [{artifact, format, description, delivery_method}]
  artifacts_handoff JSONB NOT NULL DEFAULT '[]',
  
  -- Metadata
  estimated_duration_weeks INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Onboarding Plans table
-- Generated instances tied to a client_project. These are the populated,
-- client-specific plans created from templates + project context.
-- ============================================================================
CREATE TABLE IF NOT EXISTS onboarding_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID REFERENCES client_projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES onboarding_plan_templates(id) ON DELETE SET NULL,
  
  -- Resolved sections (populated from template + project context)
  -- These are the final, client-specific values (tokens replaced)
  setup_requirements JSONB NOT NULL DEFAULT '[]',
  milestones JSONB NOT NULL DEFAULT '[]',
  communication_plan JSONB NOT NULL DEFAULT '{}',
  win_conditions JSONB NOT NULL DEFAULT '[]',
  warranty JSONB NOT NULL DEFAULT '{}',
  artifacts_handoff JSONB NOT NULL DEFAULT '[]',
  
  -- PDF and delivery
  pdf_url TEXT,
  n8n_webhook_fired_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  
  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',          -- Generated but not yet reviewed/sent
    'sent',           -- Sent to client via email
    'acknowledged',   -- Client has viewed/acknowledged the plan
    'in_progress',    -- Actively being executed
    'complete'        -- All milestones delivered
  )),
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  
  -- Admin overrides
  admin_notes TEXT,
  is_customized BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Extend client_projects with onboarding_plan reference
-- ============================================================================
ALTER TABLE client_projects
ADD COLUMN IF NOT EXISTS onboarding_plan_id UUID REFERENCES onboarding_plans(id) ON DELETE SET NULL;

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_onboarding_plan_templates_content_type
ON onboarding_plan_templates(content_type);

CREATE INDEX IF NOT EXISTS idx_onboarding_plan_templates_service_type
ON onboarding_plan_templates(service_type)
WHERE service_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_plan_templates_active
ON onboarding_plan_templates(is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_onboarding_plans_client_project
ON onboarding_plans(client_project_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_plans_status
ON onboarding_plans(status);

CREATE INDEX IF NOT EXISTS idx_onboarding_plans_template
ON onboarding_plans(template_id);

CREATE INDEX IF NOT EXISTS idx_client_projects_onboarding_plan
ON client_projects(onboarding_plan_id)
WHERE onboarding_plan_id IS NOT NULL;

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE onboarding_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_plans ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies - Admin management + public read for plans
-- ============================================================================

-- Templates: Admin only
DROP POLICY IF EXISTS "Admins can manage onboarding templates" ON onboarding_plan_templates;
CREATE POLICY "Admins can manage onboarding templates"
  ON onboarding_plan_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Plans: Admin can manage all, public can read their own (via service role bypass)
DROP POLICY IF EXISTS "Admins can manage onboarding plans" ON onboarding_plans;
CREATE POLICY "Admins can manage onboarding plans"
  ON onboarding_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public read access for onboarding plans (accessed via direct link, like proposals)
DROP POLICY IF EXISTS "Public can read onboarding plans" ON onboarding_plans;
CREATE POLICY "Public can read onboarding plans"
  ON onboarding_plans FOR SELECT
  USING (true);

-- ============================================================================
-- Trigger for updated_at on onboarding_plans
-- ============================================================================
CREATE OR REPLACE FUNCTION update_onboarding_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS onboarding_plans_updated_at ON onboarding_plans;
CREATE TRIGGER onboarding_plans_updated_at
  BEFORE UPDATE ON onboarding_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_plans_updated_at();

-- ============================================================================
-- Trigger for updated_at on onboarding_plan_templates
-- ============================================================================
CREATE OR REPLACE FUNCTION update_onboarding_plan_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS onboarding_plan_templates_updated_at ON onboarding_plan_templates;
CREATE TRIGGER onboarding_plan_templates_updated_at
  BEFORE UPDATE ON onboarding_plan_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_plan_templates_updated_at();

-- ============================================================================
-- Useful view: Onboarding plan with project context
-- ============================================================================
CREATE OR REPLACE VIEW onboarding_plan_details AS
SELECT
  op.*,
  cp.client_name,
  cp.client_email,
  cp.client_company,
  cp.project_status,
  cp.current_phase,
  cp.product_purchased,
  cp.project_start_date,
  cp.estimated_end_date,
  opt.name as template_name,
  opt.content_type as template_content_type,
  opt.service_type as template_service_type
FROM onboarding_plans op
LEFT JOIN client_projects cp ON op.client_project_id = cp.id
LEFT JOIN onboarding_plan_templates opt ON op.template_id = opt.id;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE onboarding_plan_templates IS 'Template definitions for client onboarding plans, keyed by content_type and service_type. Contains JSONB sections with dynamic tokens.';
COMMENT ON TABLE onboarding_plans IS 'Generated client-specific onboarding plans populated from templates with real project data. Tracks status through draft → sent → acknowledged → in_progress → complete.';

COMMENT ON COLUMN onboarding_plan_templates.setup_requirements IS 'JSON array: [{title, description, category, is_client_action}]';
COMMENT ON COLUMN onboarding_plan_templates.milestones_template IS 'JSON array: [{week, title, description, deliverables[], phase}]';
COMMENT ON COLUMN onboarding_plan_templates.communication_plan IS 'JSON object: {cadence, channels[], meetings[{type, frequency, duration_minutes}], escalation_path}';
COMMENT ON COLUMN onboarding_plan_templates.win_conditions IS 'JSON array: [{metric, target, measurement_method, timeframe}]';
COMMENT ON COLUMN onboarding_plan_templates.warranty IS 'JSON object: {duration_months, coverage_description, exclusions[], extended_support_available, extended_support_description}';
COMMENT ON COLUMN onboarding_plan_templates.artifacts_handoff IS 'JSON array: [{artifact, format, description, delivery_method}]';

COMMENT ON COLUMN onboarding_plans.pdf_url IS 'Public URL of the generated onboarding plan PDF in Supabase Storage';
COMMENT ON COLUMN onboarding_plans.n8n_webhook_fired_at IS 'Timestamp when the n8n email webhook was triggered';
COMMENT ON COLUMN onboarding_plans.email_sent_at IS 'Timestamp when n8n confirmed email delivery (set via callback)';
COMMENT ON COLUMN onboarding_plans.is_customized IS 'Whether admin has manually customized this plan after generation';
