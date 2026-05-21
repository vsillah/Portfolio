CREATE TABLE IF NOT EXISTS agent_governance_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type TEXT NOT NULL DEFAULT 'agent_governance_client_audit',
  format TEXT NOT NULL CHECK (format IN ('json', 'markdown')),
  classification TEXT NOT NULL DEFAULT 'client_safe',
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  client_project_id TEXT,
  from_at TIMESTAMPTZ,
  to_at TIMESTAMPTZ,
  matching_run_count INTEGER,
  requested_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_governance_exports_created_at
  ON agent_governance_exports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_governance_exports_run_id
  ON agent_governance_exports (run_id);

CREATE INDEX IF NOT EXISTS idx_agent_governance_exports_client_project_id
  ON agent_governance_exports (client_project_id)
  WHERE client_project_id IS NOT NULL;

ALTER TABLE agent_governance_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage agent_governance_exports" ON agent_governance_exports;
CREATE POLICY "Admins can manage agent_governance_exports"
  ON agent_governance_exports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
