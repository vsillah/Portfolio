-- Add TikTok as a first-class campaign calendar lane.
-- This only enables planning/export-readiness rows. Publishing remains guarded by
-- social_content_publishes, platform configuration, privacy, and final submission gates.

ALTER TABLE public.social_content_calendar_items
  DROP CONSTRAINT IF EXISTS social_content_calendar_items_channel_check;

ALTER TABLE public.social_content_calendar_items
  ADD CONSTRAINT social_content_calendar_items_channel_check
  CHECK (channel IN ('linkedin', 'youtube_shorts', 'instagram_reels', 'tiktok', 'thumbnail'));
