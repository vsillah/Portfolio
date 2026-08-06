ALTER TABLE social_content_calendar_items
DROP CONSTRAINT IF EXISTS social_content_calendar_items_channel_check;

ALTER TABLE social_content_calendar_items
ADD CONSTRAINT social_content_calendar_items_channel_check
CHECK (channel IN (
  'linkedin',
  'youtube',
  'youtube_shorts',
  'instagram',
  'instagram_reels',
  'facebook',
  'tiktok',
  'x',
  'thumbnail'
));
