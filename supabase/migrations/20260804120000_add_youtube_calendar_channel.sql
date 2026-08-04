-- Add full YouTube videos as a first-class campaign calendar lane.
-- This only enables planning/release-readiness rows. Uploads, external scheduling,
-- provider credentials, and publishing stay guarded by Social Content platform
-- submission gates and configured adapters.

ALTER TABLE public.social_content_calendar_items
  DROP CONSTRAINT IF EXISTS social_content_calendar_items_channel_check;

ALTER TABLE public.social_content_calendar_items
  ADD CONSTRAINT social_content_calendar_items_channel_check
  CHECK (channel IN ('linkedin', 'youtube', 'youtube_shorts', 'instagram_reels', 'tiktok', 'thumbnail'));
