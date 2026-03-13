-- Add thumbnail_url to video_generation_jobs for HeyGen webhook payload.
-- Apply after 2026_03_11_video_generation_jobs.sql.

ALTER TABLE video_generation_jobs
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
