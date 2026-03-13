-- Allow avatar_id and voice_id to be null when using Template API (Brand System).
-- Template mode uses HEYGEN_TEMPLATE_ID + HEYGEN_BRAND_VOICE_ID instead of avatar/voice.
ALTER TABLE video_generation_jobs ALTER COLUMN avatar_id DROP NOT NULL;
ALTER TABLE video_generation_jobs ALTER COLUMN voice_id DROP NOT NULL;
