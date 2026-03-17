-- ============================================================================
-- Kickoff Agenda & Access Provisioning Tracker
-- Adds kickoff_agendas table for personalized kickoff call scripts,
-- and provisioning_items table for interactive access tracking.
-- ============================================================================

-- ============================================================================
-- 1. Kickoff Agenda Script Templates
-- Reusable talk-track templates that get populated with project data.
-- ============================================================================
CREATE TABLE IF NOT EXISTS kickoff_agenda_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  service_type TEXT,
  content_type TEXT,

  intro_script TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  timeline_script TEXT NOT NULL,
  availability_script TEXT NOT NULL,
  platform_signup_script TEXT NOT NULL,
  wrapup_script TEXT NOT NULL,

  estimated_duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE kickoff_agenda_templates IS 'Reusable kickoff call SOP script templates populated with project data';

-- ============================================================================
-- 2. Kickoff Agendas (per-project, generated from template + project data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS kickoff_agendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES kickoff_agenda_templates(id) ON DELETE SET NULL,

  intro_script TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  timeline_script TEXT NOT NULL,
  availability_script TEXT NOT NULL,
  platform_signup_script TEXT NOT NULL,
  wrapup_script TEXT NOT NULL,

  estimated_duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'used', 'archived')),

  used_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_kickoff_agenda_per_project UNIQUE (client_project_id)
);

CREATE INDEX IF NOT EXISTS idx_kickoff_agendas_project
  ON kickoff_agendas(client_project_id);

COMMENT ON TABLE kickoff_agendas IS 'Per-project kickoff call agenda generated from template + onboarding plan data';

-- ============================================================================
-- 3. Provisioning Items (interactive access tracking per project)
-- Extracted from onboarding_plans.setup_requirements JSONB into a trackable table.
-- ============================================================================
CREATE TABLE IF NOT EXISTS provisioning_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'access'
    CHECK (category IN ('access', 'documentation', 'team', 'security', 'setup', 'communication', 'coordination')),
  is_client_action BOOLEAN NOT NULL DEFAULT true,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'complete', 'blocked', 'skipped')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  blocker_note TEXT,

  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_items_project
  ON provisioning_items(client_project_id, display_order);

COMMENT ON TABLE provisioning_items IS 'Interactive access provisioning checklist items per project, extracted from onboarding plan setup_requirements';

-- ============================================================================
-- 4. Offboarding Checklists
-- Reverse of provisioning: access revocation, handoff, archival.
-- ============================================================================
CREATE TABLE IF NOT EXISTS offboarding_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'complete')),

  delivery_confirmed_at TIMESTAMPTZ,
  client_confirmed_at TIMESTAMPTZ,
  warranty_activated_at TIMESTAMPTZ,
  access_revoked_at TIMESTAMPTZ,
  slack_archived_at TIMESTAMPTZ,
  final_invoice_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_offboarding_per_project UNIQUE (client_project_id)
);

CREATE INDEX IF NOT EXISTS idx_offboarding_checklists_project
  ON offboarding_checklists(client_project_id);

COMMENT ON TABLE offboarding_checklists IS 'Formal offboarding workflow: delivery confirmation, warranty activation, access revocation, archival';

-- ============================================================================
-- 5. RLS
-- ============================================================================
ALTER TABLE kickoff_agenda_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisioning_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offboarding_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage kickoff_agenda_templates" ON kickoff_agenda_templates;
CREATE POLICY "Admins can manage kickoff_agenda_templates"
  ON kickoff_agenda_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage kickoff_agendas" ON kickoff_agendas;
CREATE POLICY "Admins can manage kickoff_agendas"
  ON kickoff_agendas FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage provisioning_items" ON provisioning_items;
CREATE POLICY "Admins can manage provisioning_items"
  ON provisioning_items FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage offboarding_checklists" ON offboarding_checklists;
CREATE POLICY "Admins can manage offboarding_checklists"
  ON offboarding_checklists FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 6. Service role + authenticated grants
-- ============================================================================
GRANT ALL ON kickoff_agenda_templates TO service_role;
GRANT ALL ON kickoff_agendas TO service_role;
GRANT ALL ON provisioning_items TO service_role;
GRANT ALL ON offboarding_checklists TO service_role;

GRANT ALL ON kickoff_agenda_templates TO authenticated;
GRANT ALL ON kickoff_agendas TO authenticated;
GRANT ALL ON provisioning_items TO authenticated;
GRANT ALL ON offboarding_checklists TO authenticated;

-- ============================================================================
-- 7. updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_kickoff_agenda_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kickoff_agenda_templates_updated_at ON kickoff_agenda_templates;
CREATE TRIGGER kickoff_agenda_templates_updated_at
  BEFORE UPDATE ON kickoff_agenda_templates
  FOR EACH ROW EXECUTE FUNCTION update_kickoff_agenda_templates_updated_at();

CREATE OR REPLACE FUNCTION update_kickoff_agendas_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kickoff_agendas_updated_at ON kickoff_agendas;
CREATE TRIGGER kickoff_agendas_updated_at
  BEFORE UPDATE ON kickoff_agendas
  FOR EACH ROW EXECUTE FUNCTION update_kickoff_agendas_updated_at();

CREATE OR REPLACE FUNCTION update_provisioning_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS provisioning_items_updated_at ON provisioning_items;
CREATE TRIGGER provisioning_items_updated_at
  BEFORE UPDATE ON provisioning_items
  FOR EACH ROW EXECUTE FUNCTION update_provisioning_items_updated_at();

CREATE OR REPLACE FUNCTION update_offboarding_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS offboarding_checklists_updated_at ON offboarding_checklists;
CREATE TRIGGER offboarding_checklists_updated_at
  BEFORE UPDATE ON offboarding_checklists
  FOR EACH ROW EXECUTE FUNCTION update_offboarding_checklists_updated_at();
