-- Voice-note content package system.
-- Turns rough voice-note ideas into governed, multi-format content packets.

CREATE TABLE IF NOT EXISTS public.content_frameworks (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  usage_guidance TEXT NOT NULL,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_idea_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'voice_note'
    CHECK (source_type IN ('voice_note', 'text_note', 'meeting', 'manual')),
  transcript_text TEXT NOT NULL,
  audio_storage_path TEXT,
  audio_file_name TEXT,
  topic_hint TEXT,
  target_audience TEXT,
  target_outputs TEXT[] NOT NULL DEFAULT ARRAY['linkedin_post']::TEXT[],
  framework_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'packet_generated', 'approved', 'rejected', 'archived')),
  created_by UUID REFERENCES public.user_profiles(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id UUID REFERENCES public.social_idea_intakes(id) ON DELETE SET NULL,
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'waiting_script_approval',
      'script_approved',
      'waiting_media_approval',
      'media_ready',
      'waiting_publish_approval',
      'published',
      'rejected',
      'archived'
    )),
  source_packet JSONB NOT NULL DEFAULT '{}'::jsonb,
  research_packet JSONB NOT NULL DEFAULT '{}'::jsonb,
  framework_ids TEXT[] NOT NULL DEFAULT '{}',
  target_outputs TEXT[] NOT NULL DEFAULT '{}',
  approval_ids UUID[] NOT NULL DEFAULT '{}',
  social_content_id UUID REFERENCES public.social_content_queue(id) ON DELETE SET NULL,
  video_idea_id UUID REFERENCES public.video_ideas_queue(id) ON DELETE SET NULL,
  presentation_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.user_profiles(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_package_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.content_packages(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'waiting_approval', 'approved', 'generated', 'published', 'rejected', 'blocked')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_id UUID REFERENCES public.agent_approvals(id) ON DELETE SET NULL,
  downstream_type TEXT,
  downstream_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_idea_intakes_created
  ON public.social_idea_intakes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_idea_intakes_status
  ON public.social_idea_intakes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_packages_created
  ON public.content_packages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_packages_status
  ON public.content_packages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_packages_intake
  ON public.content_packages(intake_id);
CREATE INDEX IF NOT EXISTS idx_content_package_outputs_package
  ON public.content_package_outputs(package_id, output_type);

ALTER TABLE public.content_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_idea_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_package_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage content_frameworks" ON public.content_frameworks;
CREATE POLICY "Admins can manage content_frameworks"
  ON public.content_frameworks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage social_idea_intakes" ON public.social_idea_intakes;
CREATE POLICY "Admins can manage social_idea_intakes"
  ON public.social_idea_intakes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage content_packages" ON public.content_packages;
CREATE POLICY "Admins can manage content_packages"
  ON public.content_packages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage content_package_outputs" ON public.content_package_outputs;
CREATE POLICY "Admins can manage content_package_outputs"
  ON public.content_package_outputs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO public.content_frameworks (
  id,
  display_name,
  creator_name,
  category,
  summary,
  usage_guidance,
  source_urls,
  metadata
) VALUES
  (
    'alex-hormozi-value-equation',
    'Value Equation / Grand Slam Offer',
    'Alex Hormozi',
    'offer_strategy',
    'Frame value through dream outcome, perceived likelihood, time delay, and effort or sacrifice.',
    'Use for posts, decks, and videos that need to turn an idea into a clear offer, guarantee, proof stack, or practical business case.',
    ARRAY['https://www.acquisition.com/'],
    '{"default_visual":"equation","public_claim_boundary":"Use as a structural influence; avoid implying endorsement."}'::jsonb
  ),
  (
    'nick-saraev-ai-content-engine',
    'AI Content Engine / Creator Systems',
    'Nick Saraev',
    'content_systems',
    'Frame content production as a repeatable AI-assisted system that converts raw ideas into platform-specific assets.',
    'Use for multi-format repurposing, creator operating systems, and packaging one source idea into posts, decks, scripts, and short-form clips.',
    ARRAY['https://nicksaraev.com/','https://makerschoolcommunity.com/'],
    '{"default_visual":"cycle","name_note":"User referenced Nick Saerev; public sources indicate Nick Saraev is the likely intended creator."}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  creator_name = EXCLUDED.creator_name,
  category = EXCLUDED.category,
  summary = EXCLUDED.summary,
  usage_guidance = EXCLUDED.usage_guidance,
  source_urls = EXCLUDED.source_urls,
  metadata = EXCLUDED.metadata,
  updated_at = now();

COMMENT ON TABLE public.social_idea_intakes IS
  'Raw brainstorming intakes, including voice-note transcripts, before public-facing content is generated.';
COMMENT ON TABLE public.content_packages IS
  'Governed multi-format content packages generated from one source packet and linked to Agent Ops approvals.';
COMMENT ON TABLE public.content_package_outputs IS
  'Individual output drafts such as LinkedIn posts, carousels, decks, video scripts, audio prompts, and captions.';
