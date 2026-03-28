-- ========================================
-- Alter social_content_config to add YouTube platform
-- ========================================
-- Expands platform CHECK and seeds a youtube config row
-- Created: 2026-03-28

-- Update platform CHECK to include youtube
ALTER TABLE public.social_content_config
    DROP CONSTRAINT IF EXISTS social_content_config_platform_check;

ALTER TABLE public.social_content_config
    ADD CONSTRAINT social_content_config_platform_check
    CHECK (platform IN ('linkedin', 'instagram', 'facebook', 'youtube'));

-- Seed youtube config row
INSERT INTO public.social_content_config (platform, credentials, settings, is_active)
VALUES ('youtube', '{}', '{"channel_id": "", "default_privacy": "private"}', false)
ON CONFLICT (platform) DO NOTHING;
