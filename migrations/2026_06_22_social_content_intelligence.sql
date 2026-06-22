-- Social Content Intelligence keeps public creator research separate from
-- private Shaka evidence and uses agent_work_items as the canonical backlog.

ALTER TABLE IF EXISTS public.social_topic_backlog
  ADD COLUMN IF NOT EXISTS agent_work_item_id UUID REFERENCES public.agent_work_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_lanes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS research_packet_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_social_topic_backlog_agent_work_item_id
  ON public.social_topic_backlog(agent_work_item_id);

CREATE TABLE IF NOT EXISTS public.social_content_research_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN (
    'youtube',
    'youtube_shorts',
    'instagram',
    'instagram_reels',
    'tiktok',
    'x',
    'linkedin',
    'other'
  )),
  creator_name TEXT,
  creator_handle TEXT,
  title TEXT,
  caption TEXT,
  thumbnail_url TEXT,
  hook_transcript TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  outlier_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  pattern_packet JSONB NOT NULL DEFAULT '{}'::jsonb,
  pattern_status TEXT NOT NULL DEFAULT 'needs_brand_translation' CHECK (pattern_status IN (
    'usable_framework',
    'needs_brand_translation',
    'too_close_to_source',
    'not_relevant'
  )),
  status TEXT NOT NULL DEFAULT 'review_ready' CHECK (status IN (
    'review_ready',
    'approved',
    'rejected',
    'archived'
  )),
  privacy_notes TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_content_research_packets_platform
  ON public.social_content_research_packets(platform);

CREATE INDEX IF NOT EXISTS idx_social_content_research_packets_status
  ON public.social_content_research_packets(status);

CREATE INDEX IF NOT EXISTS idx_social_content_research_packets_outlier_score
  ON public.social_content_research_packets(outlier_score DESC);

CREATE INDEX IF NOT EXISTS idx_social_content_research_packets_retrieved_at
  ON public.social_content_research_packets(retrieved_at DESC);

ALTER TABLE public.social_content_research_packets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read social content research packets" ON public.social_content_research_packets;
CREATE POLICY "Admins can read social content research packets"
  ON public.social_content_research_packets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert social content research packets" ON public.social_content_research_packets;
CREATE POLICY "Admins can insert social content research packets"
  ON public.social_content_research_packets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update social content research packets" ON public.social_content_research_packets;
CREATE POLICY "Admins can update social content research packets"
  ON public.social_content_research_packets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.social_content_research_packets TO authenticated;
GRANT ALL ON public.social_content_research_packets TO service_role;

DROP TRIGGER IF EXISTS update_social_content_research_packets_updated_at
  ON public.social_content_research_packets;
CREATE TRIGGER update_social_content_research_packets_updated_at
  BEFORE UPDATE ON public.social_content_research_packets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.social_content_research_packets IS
  'Read-only public creator research packets used by Social Content Intelligence review. Packets do not create drafts, upload media, schedule, or publish.';

COMMENT ON COLUMN public.social_content_research_packets.actor_metadata IS
  'Apify actor/run metadata and retrieval configuration for source transparency.';

COMMENT ON COLUMN public.social_content_research_packets.pattern_packet IS
  'Reusable pattern analysis. Final content must be rewritten in Vambah voice and AmaduTown brand style.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'video_generation_jobs'
      AND constraint_name = 'video_generation_jobs_channel_check'
  ) THEN
    ALTER TABLE public.video_generation_jobs
      DROP CONSTRAINT video_generation_jobs_channel_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'video_generation_jobs'
  ) THEN
    ALTER TABLE public.video_generation_jobs
      ADD CONSTRAINT video_generation_jobs_channel_check
      CHECK (channel IN ('youtube', 'youtube_shorts', 'linkedin', 'linkedin_video', 'instagram_reels'));
  END IF;
END $$;
