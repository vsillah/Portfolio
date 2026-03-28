-- ========================================
-- Social Content Publishes Schema
-- ========================================
-- Purpose: Per-platform publish tracking for social content queue items
-- One source row in social_content_queue can be published to multiple platforms independently
-- Created: 2026-03-28

CREATE TABLE IF NOT EXISTS public.social_content_publishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.social_content_queue(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'instagram', 'facebook', 'youtube')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'skipped')),
    platform_post_id TEXT,
    platform_post_url TEXT,
    error_message TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, platform)
);

-- Indexes
CREATE INDEX idx_social_content_publishes_content ON public.social_content_publishes(content_id);
CREATE INDEX idx_social_content_publishes_status ON public.social_content_publishes(status);
CREATE INDEX idx_social_content_publishes_platform ON public.social_content_publishes(platform);

-- Enable RLS
ALTER TABLE public.social_content_publishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON public.social_content_publishes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.social_content_publishes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.social_content_publishes
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE TRIGGER update_social_content_publishes_updated_at
    BEFORE UPDATE ON public.social_content_publishes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Permissions
GRANT ALL ON public.social_content_publishes TO authenticated;
GRANT ALL ON public.social_content_publishes TO service_role;

COMMENT ON TABLE public.social_content_publishes IS 'Per-platform publish tracking for social content queue items';
COMMENT ON COLUMN public.social_content_publishes.platform_post_url IS 'Direct URL to the published post on the platform';
COMMENT ON COLUMN public.social_content_publishes.error_message IS 'Error details when publish fails — not exposed to end users';
