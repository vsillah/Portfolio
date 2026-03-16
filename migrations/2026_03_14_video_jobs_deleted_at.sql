-- Add soft-delete support to video_generation_jobs
ALTER TABLE video_generation_jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
