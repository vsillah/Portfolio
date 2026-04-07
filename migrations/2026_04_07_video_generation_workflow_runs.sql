-- Audit log for Video Generation admin syncs (HeyGen catalog + Drive scripts).
-- Mirrors value_evidence_workflow_runs shape for shared UI (ExtractionStatusChip / useWorkflowStatus).

CREATE TABLE IF NOT EXISTS video_generation_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workflow_id TEXT NOT NULL CHECK (workflow_id IN ('vgen_heygen', 'vgen_drive')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),

  stages JSONB DEFAULT '{}',
  items_inserted INTEGER DEFAULT 0,
  error_message TEXT,
  summary TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vgen_runs_workflow_triggered
  ON video_generation_workflow_runs(workflow_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_vgen_runs_status
  ON video_generation_workflow_runs(status)
  WHERE status = 'running';

COMMENT ON TABLE video_generation_workflow_runs IS 'HeyGen catalog sync (vgen_heygen) and Drive script sync (vgen_drive) for admin progress chips.';
COMMENT ON COLUMN video_generation_workflow_runs.summary IS 'Short label shown in sync history (maps to meeting_title in API for chip UI).';

ALTER TABLE video_generation_workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage video generation workflow runs" ON video_generation_workflow_runs;
CREATE POLICY "Admins can manage video generation workflow runs"
  ON video_generation_workflow_runs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
