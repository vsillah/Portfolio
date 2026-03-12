-- Video generation jobs for HeyGen pipeline
-- Tracks script, format, channel, HeyGen status, and links to videos when complete.

CREATE TABLE IF NOT EXISTS video_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_source TEXT NOT NULL CHECK (script_source IN ('manual', 'drive_script', 'drive_broll', 'campaign')),
  script_text TEXT NOT NULL,
  drive_file_id TEXT,
  drive_file_name TEXT,
  target_type TEXT CHECK (target_type IS NULL OR target_type IN ('client_project', 'lead', 'campaign')),
  target_id UUID,
  avatar_id TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9', '9:16')),
  channel TEXT NOT NULL DEFAULT 'youtube' CHECK (channel IN ('youtube', 'youtube_shorts', 'linkedin', 'linkedin_video')),
  heygen_video_id TEXT,
  heygen_status TEXT CHECK (heygen_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  video_url TEXT,
  video_record_id BIGINT REFERENCES videos(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_heygen_status ON video_generation_jobs(heygen_status);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_created_at ON video_generation_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_channel ON video_generation_jobs(channel);

ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_generation_job_id UUID REFERENCES video_generation_jobs(id);

ALTER TABLE video_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage video_generation_jobs" ON video_generation_jobs;
CREATE POLICY "Admins can manage video_generation_jobs"
  ON video_generation_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
