-- Video ideas queue for LLM-generated video ideas (script + storyboard)
-- Used by: generate-ideas API, ideas-queue UI, ideas-queue generate route

CREATE TABLE IF NOT EXISTS video_ideas_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  script_text TEXT NOT NULL,
  storyboard_json JSONB,
  source TEXT NOT NULL DEFAULT 'llm_generated'
    CHECK (source IN ('llm_generated', 'drive_script', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'generated', 'dismissed')),
  video_generation_job_id UUID REFERENCES video_generation_jobs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_ideas_queue_status ON video_ideas_queue(status);
CREATE INDEX IF NOT EXISTS idx_video_ideas_queue_created_at ON video_ideas_queue(created_at DESC);

ALTER TABLE video_ideas_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage video_ideas_queue" ON video_ideas_queue;
CREATE POLICY "Admins can manage video_ideas_queue"
  ON video_ideas_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
