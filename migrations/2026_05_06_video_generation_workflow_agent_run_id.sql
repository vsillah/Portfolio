-- Link video generation workflow progress rows to the shared Agent Operations trace spine.
ALTER TABLE video_generation_workflow_runs
  ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_video_generation_workflow_runs_agent_run_id
  ON video_generation_workflow_runs(agent_run_id)
  WHERE agent_run_id IS NOT NULL;

COMMENT ON COLUMN video_generation_workflow_runs.agent_run_id IS 'Shared Agent Operations run trace for video generation sync workflows.';
