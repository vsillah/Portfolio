-- ========================================
-- Social Topic Backlog
-- ========================================
-- Purpose: Store Shaka-curated LinkedIn topic triggers as a reusable backlog
-- for Social Content drafts. Entries are generated from sanitized internal
-- summaries and remain review-only until a human selects them for a draft.

CREATE TABLE IF NOT EXISTS public.social_topic_backlog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_key TEXT NOT NULL UNIQUE,

    title TEXT NOT NULL,
    triggering_event TEXT NOT NULL,
    source_type TEXT NOT NULL
        CHECK (source_type IN (
            'meeting',
            'shipped_feature',
            'client_safe_project',
            'chronicle_observation',
            'chatgpt_session',
            'open_brain',
            'portfolio_work'
        )),
    source_label TEXT,
    source_ids TEXT[] DEFAULT '{}',

    why_vambah_can_speak TEXT NOT NULL,
    brand_goal TEXT,
    content_angle TEXT,
    suggested_hook TEXT,
    audience TEXT,
    sensitivity TEXT NOT NULL DEFAULT 'needs_review'
        CHECK (sensitivity IN ('public_safe', 'client_safe_summary', 'needs_review')),
    evidence_summary TEXT,
    claim_boundaries TEXT[] DEFAULT '{}',

    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'selected', 'used', 'dismissed', 'archived')),
    source_policy TEXT NOT NULL DEFAULT 'sanitized_summaries_only',
    source_counts JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,

    generated_by UUID,
    selected_for_content_id UUID REFERENCES public.social_content_queue(id) ON DELETE SET NULL,
    selected_at TIMESTAMPTZ,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_topic_backlog_status
    ON public.social_topic_backlog(status);

CREATE INDEX IF NOT EXISTS idx_social_topic_backlog_last_seen
    ON public.social_topic_backlog(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_topic_backlog_source_type
    ON public.social_topic_backlog(source_type);

ALTER TABLE public.social_topic_backlog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.social_topic_backlog;
CREATE POLICY "Enable read for authenticated users" ON public.social_topic_backlog
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for service role" ON public.social_topic_backlog;
CREATE POLICY "Enable insert for service role" ON public.social_topic_backlog
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable update for service role" ON public.social_topic_backlog;
CREATE POLICY "Enable update for service role" ON public.social_topic_backlog
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.social_topic_backlog TO authenticated;
GRANT ALL ON public.social_topic_backlog TO service_role;

DROP TRIGGER IF EXISTS update_social_topic_backlog_updated_at ON public.social_topic_backlog;
CREATE TRIGGER update_social_topic_backlog_updated_at
    BEFORE UPDATE ON public.social_topic_backlog
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.social_topic_backlog IS 'Shaka-curated review-only Social Content topic triggers generated from sanitized internal summaries';
COMMENT ON COLUMN public.social_topic_backlog.source_policy IS 'Privacy policy used by the generator; raw private sources are not stored in this table';
COMMENT ON COLUMN public.social_topic_backlog.selected_for_content_id IS 'Social Content draft that pulled this topic into review, if selected';
