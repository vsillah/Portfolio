-- Add broll_output_path to video_generation_jobs for traceability when B-roll is captured as part of generation.
ALTER TABLE video_generation_jobs ADD COLUMN IF NOT EXISTS broll_output_path TEXT;
