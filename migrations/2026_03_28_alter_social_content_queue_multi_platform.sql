-- ========================================
-- Alter social_content_queue for multi-platform publishing
-- ========================================
-- Adds target_platforms array, video generation method, YouTube-specific fields,
-- and expands platform CHECK to include youtube
-- Created: 2026-03-28

-- Add new columns for multi-platform publishing
ALTER TABLE public.social_content_queue
    ADD COLUMN IF NOT EXISTS target_platforms TEXT[] DEFAULT '{linkedin}',
    ADD COLUMN IF NOT EXISTS video_generation_method TEXT DEFAULT 'none'
        CHECK (video_generation_method IN ('heygen_avatar', 'animated_image', 'none')),
    ADD COLUMN IF NOT EXISTS youtube_title TEXT,
    ADD COLUMN IF NOT EXISTS youtube_description TEXT;

-- Update platform CHECK to include youtube
ALTER TABLE public.social_content_queue
    DROP CONSTRAINT IF EXISTS social_content_queue_platform_check;

ALTER TABLE public.social_content_queue
    ADD CONSTRAINT social_content_queue_platform_check
    CHECK (platform IN ('linkedin', 'instagram', 'facebook', 'youtube'));

COMMENT ON COLUMN public.social_content_queue.target_platforms IS 'Which platforms to publish to — one source row, multi-platform publish';
COMMENT ON COLUMN public.social_content_queue.video_generation_method IS 'How to generate video for YouTube Shorts: heygen_avatar, animated_image, or none';
