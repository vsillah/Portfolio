-- ========================================
-- Social Platform Publishing Expansion
-- ========================================
-- Purpose: Enable TikTok as a governed social content target alongside LinkedIn and Instagram.
-- Created: 2026-06-29

ALTER TABLE public.social_content_config
    DROP CONSTRAINT IF EXISTS social_content_config_platform_check;

ALTER TABLE public.social_content_config
    ADD CONSTRAINT social_content_config_platform_check
    CHECK (platform IN ('linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'));

ALTER TABLE public.social_content_queue
    DROP CONSTRAINT IF EXISTS social_content_queue_platform_check;

ALTER TABLE public.social_content_queue
    ADD CONSTRAINT social_content_queue_platform_check
    CHECK (platform IN ('linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'));

ALTER TABLE public.social_content_publishes
    DROP CONSTRAINT IF EXISTS social_content_publishes_platform_check;

ALTER TABLE public.social_content_publishes
    ADD CONSTRAINT social_content_publishes_platform_check
    CHECK (platform IN ('linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'));

INSERT INTO public.social_content_config (platform, credentials, settings, is_active)
VALUES (
    'tiktok',
    '{}',
    '{
      "privacy_level": "SELF_ONLY",
      "creator_info_confirmed": false,
      "source_url_approved": false,
      "disable_comment": false,
      "disable_duet": false,
      "disable_stitch": false,
      "brand_content_toggle": false,
      "brand_organic_toggle": false,
      "is_aigc": true
    }',
    false
)
ON CONFLICT (platform) DO NOTHING;

UPDATE public.social_content_config
SET settings = COALESCE(settings, '{}'::jsonb) || '{
  "graph_api_version": "v20.0",
  "share_reels_to_feed": true
}'::jsonb
WHERE platform = 'instagram';

UPDATE public.social_content_config
SET settings = COALESCE(settings, '{}'::jsonb) || '{
  "graph_api_version": "v20.0",
  "default_published": true
}'::jsonb
WHERE platform = 'facebook';
