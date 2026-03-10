-- ========================================
-- Social Content Config Schema
-- ========================================
-- Purpose: Store per-platform credentials and settings for social content publishing
-- Used by: Admin UI, WF-SOC-001, WF-SOC-002
-- Created: 2026-03-09

CREATE TABLE IF NOT EXISTS public.social_content_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    platform TEXT NOT NULL UNIQUE
        CHECK (platform IN ('linkedin', 'instagram', 'facebook')),

    -- Platform credentials (stored as JSONB for flexibility per platform)
    credentials JSONB DEFAULT '{}',

    -- Platform-specific settings
    settings JSONB DEFAULT '{}',

    is_active BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.social_content_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON public.social_content_config
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.social_content_config
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.social_content_config
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE TRIGGER update_social_content_config_updated_at
    BEFORE UPDATE ON public.social_content_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Permissions
GRANT ALL ON public.social_content_config TO authenticated;
GRANT ALL ON public.social_content_config TO service_role;

-- Seed default configs
INSERT INTO public.social_content_config (platform, credentials, settings, is_active)
VALUES
    ('linkedin', '{}', '{"default_voice_id": "", "author_urn": "", "post_visibility": "PUBLIC"}', false),
    ('instagram', '{}', '{}', false),
    ('facebook', '{}', '{}', false)
ON CONFLICT (platform) DO NOTHING;

COMMENT ON TABLE public.social_content_config IS 'Per-platform credentials and settings for social content publishing';
COMMENT ON COLUMN public.social_content_config.credentials IS 'Platform API credentials (access tokens, client IDs, etc.)';
COMMENT ON COLUMN public.social_content_config.settings IS 'Platform-specific settings (voice ID, author URN, visibility, etc.)';
