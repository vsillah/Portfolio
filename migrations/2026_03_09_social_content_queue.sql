-- ========================================
-- Social Content Queue Schema
-- ========================================
-- Purpose: Store AI-generated social media content drafts from meeting transcripts
-- Used by: WF-SOC-001 (Content Extraction), WF-SOC-002 (Publishing), Admin UI
-- Dependencies: meeting_records table
-- Created: 2026-03-09

CREATE TABLE IF NOT EXISTS public.social_content_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source
    meeting_record_id UUID REFERENCES public.meeting_records(id) ON DELETE SET NULL,

    -- Target platform and status
    platform TEXT NOT NULL DEFAULT 'linkedin'
        CHECK (platform IN ('linkedin', 'instagram', 'facebook')),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'rejected')),

    -- Post content (Hormozi-style copy)
    post_text TEXT NOT NULL,
    cta_text TEXT,
    cta_url TEXT,
    hashtags TEXT[] DEFAULT '{}',

    -- Generated image
    image_url TEXT,
    image_prompt TEXT,
    framework_visual_type TEXT
        CHECK (framework_visual_type IN (
            'flowchart', 'matrix', 'equation', 'funnel',
            'before_after', 'architecture', 'pillars', 'timeline', 'cycle'
        )),

    -- Voiceover
    voiceover_url TEXT,
    voiceover_text TEXT,

    -- Video (future)
    video_url TEXT,

    -- AI extraction metadata
    topic_extracted JSONB,
    hormozi_framework JSONB,
    rag_context JSONB,

    -- Scheduling and publishing
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    platform_post_id TEXT,

    -- Admin review
    admin_notes TEXT,
    reviewed_by UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_social_content_queue_status ON public.social_content_queue(status);
CREATE INDEX idx_social_content_queue_platform ON public.social_content_queue(platform);
CREATE INDEX idx_social_content_queue_meeting ON public.social_content_queue(meeting_record_id);
CREATE INDEX idx_social_content_queue_scheduled ON public.social_content_queue(scheduled_for)
    WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_social_content_queue_created ON public.social_content_queue(created_at DESC);

-- Enable RLS
ALTER TABLE public.social_content_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON public.social_content_queue
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.social_content_queue
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.social_content_queue
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE TRIGGER update_social_content_queue_updated_at
    BEFORE UPDATE ON public.social_content_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Permissions
GRANT ALL ON public.social_content_queue TO authenticated;
GRANT ALL ON public.social_content_queue TO service_role;

COMMENT ON TABLE public.social_content_queue IS 'AI-generated social media content drafts from meeting transcripts with human-in-the-loop review';
COMMENT ON COLUMN public.social_content_queue.framework_visual_type IS 'Type of framework/system diagram used for the generated image';
COMMENT ON COLUMN public.social_content_queue.rag_context IS 'RAG snippets from Pinecone used to personalize the post with real experience';
COMMENT ON COLUMN public.social_content_queue.hormozi_framework IS 'Which Hormozi framework was applied (value equation, offer, lead magnet, etc.)';
