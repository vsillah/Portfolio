-- Drive sync state and video queue for Phase 2
-- drive_sync_state: tracks last sync per folder to avoid re-processing
-- drive_video_queue: queue of Drive script changes for admin review (no auto-generate)

-- Sync state: one row per folder we poll
CREATE TABLE IF NOT EXISTS drive_sync_state (
  folder_id TEXT PRIMARY KEY,
  last_modified TIMESTAMPTZ NOT NULL,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Queue: items from Drive script changes; admin reviews and triggers generation
CREATE TABLE IF NOT EXISTS drive_video_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id TEXT NOT NULL,
  drive_file_name TEXT NOT NULL,
  script_text_prior TEXT,
  script_text TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'dismissed')),
  video_generation_job_id UUID REFERENCES video_generation_jobs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drive_video_queue_status ON drive_video_queue(status);
CREATE INDEX IF NOT EXISTS idx_drive_video_queue_detected_at ON drive_video_queue(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_video_queue_drive_file_id ON drive_video_queue(drive_file_id);

ALTER TABLE drive_video_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage drive_video_queue" ON drive_video_queue;
CREATE POLICY "Admins can manage drive_video_queue"
  ON drive_video_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- drive_sync_state is updated by cron (service role); no RLS policy needed for admin read
-- Cron uses supabaseAdmin which bypasses RLS
DROP POLICY IF EXISTS "Admins can read drive_sync_state" ON drive_sync_state;
CREATE POLICY "Admins can read drive_sync_state"
  ON drive_sync_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
