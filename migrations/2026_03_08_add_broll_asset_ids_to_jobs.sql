-- Add broll_asset_ids array to video_generation_jobs for linking to shared broll_library.
-- Replaces per-job broll_output_path for new jobs; old column kept for backward compat.

ALTER TABLE video_generation_jobs
  ADD COLUMN IF NOT EXISTS broll_asset_ids UUID[];
