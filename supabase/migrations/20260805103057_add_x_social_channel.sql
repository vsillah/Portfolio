-- Add X as a first-class campaign calendar lane.
-- This enables planning and manual handoff rows only. Automatic X posting is not
-- connected; public posting remains outside Portfolio until a provider adapter
-- and explicit publication gate are approved.

ALTER TABLE public.social_content_calendar_items
  DROP CONSTRAINT IF EXISTS social_content_calendar_items_channel_check;

ALTER TABLE public.social_content_calendar_items
  ADD CONSTRAINT social_content_calendar_items_channel_check
  CHECK (channel IN ('linkedin', 'youtube', 'youtube_shorts', 'instagram_reels', 'tiktok', 'x', 'thumbnail'));
