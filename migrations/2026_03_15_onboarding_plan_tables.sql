-- ============================================================================
-- Migration: Create onboarding_plan_templates and onboarding_plans tables
-- Date: 2026-03-15
-- Purpose: Add tables for onboarding plan templates and generated plans so
--          Admin → Onboarding Templates and related APIs work. Schema aligned
--          with database_schema_onboarding_plans.sql; service_type includes
--          'warranty' to match 2026_02_12_services_service_type_warranty.
-- ============================================================================

-- Onboarding Plan Templates
CREATE TABLE IF NOT EXISTS onboarding_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'product', 'project', 'video', 'publication', 'music',
    'lead_magnet', 'prototype', 'service'
  )),
  service_type TEXT CHECK (service_type IS NULL OR service_type IN (
    'training', 'speaking', 'consulting', 'coaching', 'workshop', 'warranty'
  )),
  offer_role TEXT CHECK (offer_role IS NULL OR offer_role IN (
    'core_offer', 'bonus', 'upsell', 'downsell',
    'continuity', 'lead_magnet', 'decoy', 'anchor'
  )),
  setup_requirements JSONB NOT NULL DEFAULT '[]',
  milestones_template JSONB NOT NULL DEFAULT '[]',
  communication_plan JSONB NOT NULL DEFAULT '{}',
  win_conditions JSONB NOT NULL DEFAULT '[]',
  warranty JSONB NOT NULL DEFAULT '{}',
  artifacts_handoff JSONB NOT NULL DEFAULT '[]',
  estimated_duration_weeks INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Plans (references templates and client_projects)
CREATE TABLE IF NOT EXISTS onboarding_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID REFERENCES client_projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES onboarding_plan_templates(id) ON DELETE SET NULL,
  setup_requirements JSONB NOT NULL DEFAULT '[]',
  milestones JSONB NOT NULL DEFAULT '[]',
  communication_plan JSONB NOT NULL DEFAULT '{}',
  win_conditions JSONB NOT NULL DEFAULT '[]',
  warranty JSONB NOT NULL DEFAULT '{}',
  artifacts_handoff JSONB NOT NULL DEFAULT '[]',
  pdf_url TEXT,
  n8n_webhook_fired_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'acknowledged', 'in_progress', 'complete'
  )),
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  admin_notes TEXT,
  is_customized BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend client_projects with onboarding_plan reference
ALTER TABLE client_projects
ADD COLUMN IF NOT EXISTS onboarding_plan_id UUID REFERENCES onboarding_plans(id) ON DELETE SET NULL;

-- Indexes
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

-- RLS
ALTER TABLE onboarding_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage onboarding templates" ON onboarding_plan_templates;
CREATE POLICY "Admins can manage onboarding templates"
  ON onboarding_plan_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage onboarding plans" ON onboarding_plans;
CREATE POLICY "Admins can manage onboarding plans"
  ON onboarding_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can read onboarding plans" ON onboarding_plans;
CREATE POLICY "Public can read onboarding plans"
  ON onboarding_plans FOR SELECT
  USING (true);

-- Triggers for updated_at
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
