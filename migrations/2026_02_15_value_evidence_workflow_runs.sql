-- ============================================================================
-- Migration: Value Evidence Workflow Runs
-- Date: 2026-02-15
-- Purpose: Track VEP-001 and VEP-002 runs for progress bar and last run display
-- ============================================================================

CREATE TABLE IF NOT EXISTS value_evidence_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workflow_id TEXT NOT NULL CHECK (workflow_id IN ('vep001', 'vep002')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),

  -- Stage progress (n8n reports each stage)
  stages JSONB DEFAULT '{}',
  -- e.g. { "reddit": "complete", "google_maps": "running", "g2": "pending", "capterra": "pending" }

  -- Results
  items_inserted INTEGER DEFAULT 0,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vep_runs_workflow_triggered
ON value_evidence_workflow_runs(workflow_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_vep_runs_status
ON value_evidence_workflow_runs(status)
WHERE status = 'running';

COMMENT ON TABLE value_evidence_workflow_runs IS 'Audit log for VEP-001 (internal extraction) and VEP-002 (social listening) workflow runs. n8n callbacks update stages and completion.';
COMMENT ON COLUMN value_evidence_workflow_runs.stages IS 'Stage progress: { "reddit": "complete", "g2": "running", ... }. Values: pending, running, complete, error, skipped';

ALTER TABLE value_evidence_workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage value evidence workflow runs" ON value_evidence_workflow_runs;
CREATE POLICY "Admins can manage value evidence workflow runs"
  ON value_evidence_workflow_runs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow service role / ingest callbacks to insert/update (n8n uses N8N_INGEST_SECRET)
-- RLS uses auth.uid(); ingest endpoints use supabaseAdmin which bypasses RLS. No extra policy needed.
