-- Add scope columns to value_evidence_workflow_runs for targeted (scoped) runs
ALTER TABLE value_evidence_workflow_runs
  ADD COLUMN IF NOT EXISTS scope_type text,
  ADD COLUMN IF NOT EXISTS scope_id text,
  ADD COLUMN IF NOT EXISTS scope_label text;

COMMENT ON COLUMN value_evidence_workflow_runs.scope_type IS 'meeting | assessment | lead | null (full sweep)';
COMMENT ON COLUMN value_evidence_workflow_runs.scope_id IS 'UUID/ID of the scoped record';
COMMENT ON COLUMN value_evidence_workflow_runs.scope_label IS 'Human-readable label for display';
