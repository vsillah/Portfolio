-- ============================================================================
-- Client Project Build Evidence
-- Date: 2026-06-15
-- Purpose: Store client-safe build, token, cost, and hourly translation evidence
--          for client dashboard projection.
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_project_build_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  evidence_key TEXT NOT NULL DEFAULT 'build_evidence',
  project_label TEXT NOT NULL,
  repo_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  cost_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  hourly_translation JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_safe_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  private_source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_client_visible BOOLEAN NOT NULL DEFAULT false,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_project_id, evidence_key)
);

CREATE INDEX IF NOT EXISTS idx_client_project_build_evidence_visible
  ON client_project_build_evidence (client_project_id, is_client_visible, captured_at DESC);

ALTER TABLE client_project_build_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage client project build evidence"
  ON client_project_build_evidence;
CREATE POLICY "Admins can manage client project build evidence"
  ON client_project_build_evidence
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT ALL ON client_project_build_evidence TO service_role;
GRANT ALL ON client_project_build_evidence TO authenticated;

CREATE OR REPLACE FUNCTION update_client_project_build_evidence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_project_build_evidence_updated_at
  ON client_project_build_evidence;
CREATE TRIGGER client_project_build_evidence_updated_at
  BEFORE UPDATE ON client_project_build_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_client_project_build_evidence_updated_at();

COMMENT ON TABLE client_project_build_evidence IS
  'Client-safe dashboard projection for build evidence, token attribution, cost translation, and hourly comparison scenarios.';
COMMENT ON COLUMN client_project_build_evidence.private_source_refs IS
  'Admin-only provenance pointers. Never return this field from token-based client dashboard APIs.';
