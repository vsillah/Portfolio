-- Add video_share_url to video_generation_jobs for persistent HeyGen share page link.
-- The video_url field is a CDN URL that expires after 7 days; video_share_url
-- (from webhook's video_share_page_url) is a permanent shareable page.
-- Apply after 2026_03_13_video_generation_jobs_thumbnail.sql.

ALTER TABLE video_generation_jobs
  ADD COLUMN IF NOT EXISTS video_share_url TEXT;
