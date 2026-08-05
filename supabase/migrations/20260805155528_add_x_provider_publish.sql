-- Enable X as a governed Social Content provider target.
-- Credentials stay in social_content_config and are not seeded here.
-- External posting remains behind the existing final platform-submission gate.

ALTER TABLE public.social_content_config
    DROP CONSTRAINT IF EXISTS social_content_config_platform_check;

ALTER TABLE public.social_content_config
    ADD CONSTRAINT social_content_config_platform_check
    CHECK (platform IN ('linkedin', 'instagram', 'facebook', 'youtube', 'tiktok', 'x'));

ALTER TABLE public.social_content_queue
    DROP CONSTRAINT IF EXISTS social_content_queue_platform_check;

ALTER TABLE public.social_content_queue
    ADD CONSTRAINT social_content_queue_platform_check
    CHECK (platform IN ('linkedin', 'instagram', 'facebook', 'youtube', 'tiktok', 'x'));

ALTER TABLE public.social_content_publishes
    DROP CONSTRAINT IF EXISTS social_content_publishes_platform_check;

ALTER TABLE public.social_content_publishes
    ADD CONSTRAINT social_content_publishes_platform_check
    CHECK (platform IN ('linkedin', 'instagram', 'facebook', 'youtube', 'tiktok', 'x'));

INSERT INTO public.social_content_config (platform, credentials, settings, is_active)
VALUES (
    'x',
    '{}',
    '{
      "profile_handle": "amadutown",
      "thread_reply_enabled": true,
      "max_post_length": 280
    }',
    false
)
ON CONFLICT (platform) DO UPDATE
SET settings = COALESCE(public.social_content_config.settings, '{}'::jsonb) || EXCLUDED.settings;
