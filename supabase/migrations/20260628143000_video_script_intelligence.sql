-- Script Intelligence for approval-gated video generation.
-- This adds reusable YouTube script templates, draft script anatomy, and
-- read-only evaluations before any HeyGen, ElevenLabs, render, upload, schedule,
-- or publish gate can run.

CREATE TABLE IF NOT EXISTS public.video_script_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'seeded'
    CHECK (source_type IN ('seeded', 'creator_pattern', 'amadutown_performance')),
  source_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  outline JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_script_templates_source_type
  ON public.video_script_templates(source_type);

CREATE INDEX IF NOT EXISTS idx_video_script_templates_status
  ON public.video_script_templates(status);

ALTER TABLE IF EXISTS public.video_ideas_queue
  ADD COLUMN IF NOT EXISTS script_template_id UUID REFERENCES public.video_script_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS script_outline JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS script_scorecard JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS research_packet_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

CREATE INDEX IF NOT EXISTS idx_video_ideas_queue_script_template_id
  ON public.video_ideas_queue(script_template_id);

CREATE TABLE IF NOT EXISTS public.video_script_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_idea_id UUID REFERENCES public.video_ideas_queue(id) ON DELETE CASCADE,
  script_template_id UUID REFERENCES public.video_script_templates(id) ON DELETE SET NULL,
  research_packet_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  scorecard JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  side_effects JSONB NOT NULL DEFAULT jsonb_build_object(
    'heygen', false,
    'elevenlabs', false,
    'render', false,
    'upload', false,
    'schedule', false,
    'publish', false,
    'external_post', false,
    'apify', false
  )
);

CREATE INDEX IF NOT EXISTS idx_video_script_evaluations_video_idea_id
  ON public.video_script_evaluations(video_idea_id);

CREATE INDEX IF NOT EXISTS idx_video_script_evaluations_template_id
  ON public.video_script_evaluations(script_template_id);

ALTER TABLE public.video_script_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_script_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read video script templates"
  ON public.video_script_templates;
CREATE POLICY "Admins can read video script templates"
  ON public.video_script_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert video script templates"
  ON public.video_script_templates;
CREATE POLICY "Admins can insert video script templates"
  ON public.video_script_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update video script templates"
  ON public.video_script_templates;
CREATE POLICY "Admins can update video script templates"
  ON public.video_script_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can read video script evaluations"
  ON public.video_script_evaluations;
CREATE POLICY "Admins can read video script evaluations"
  ON public.video_script_evaluations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert video script evaluations"
  ON public.video_script_evaluations;
CREATE POLICY "Admins can insert video script evaluations"
  ON public.video_script_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.video_script_templates TO authenticated;
GRANT SELECT, INSERT ON public.video_script_evaluations TO authenticated;
GRANT ALL ON public.video_script_templates TO service_role;
GRANT ALL ON public.video_script_evaluations TO service_role;

DROP TRIGGER IF EXISTS update_video_script_templates_updated_at
  ON public.video_script_templates;
CREATE TRIGGER update_video_script_templates_updated_at
  BEFORE UPDATE ON public.video_script_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.video_script_templates (key, name, description, source_type, source_urls, outline)
VALUES
  (
    'killer_script',
    'Killer script',
    'Start from a concrete pain, open a loop, teach the frame, prove it, then close with a clear next step.',
    'seeded',
    ARRAY['https://youtu.be/IUE8o_e4uCY', 'https://youtu.be/RagRPz6DI6U'],
    jsonb_build_object(
      'pain_point', 'Name the practical problem the viewer already feels before explaining the idea.',
      'hook', 'Lead with a specific tension or surprising consequence.',
      'open_loop', 'Promise the viewer a clearer way to understand or solve the problem.',
      'frame', 'Reframe the problem into an operating principle they can use.',
      'proof_demo', 'Show the shipped workflow, artifact, or lived example that earns the claim.',
      'teaching_beats', jsonb_build_array('What the audience is trying to do.', 'Where the old approach breaks.', 'What the new operating layer changes.'),
      'cta', 'Invite the viewer to take one review, waitlist, or discovery action.',
      'closing_question', 'Ask where this same problem is showing up in their work.',
      'thumbnail_promise', 'Make the pain or before/after result visible in one plain phrase.',
      'source_distance_notes', 'Use creator structure only. Rewrite the claim, language, examples, and visual identity for AmaduTown.'
    )
  ),
  (
    'problem_proof_offer',
    'Problem, proof, offer',
    'A direct launch structure for course, workshop, or service content that needs a visible CTA.',
    'seeded',
    ARRAY[]::TEXT[],
    jsonb_build_object(
      'pain_point', 'Identify the cost of the current behavior or workflow.',
      'hook', 'Say the uncomfortable truth in one clean sentence.',
      'open_loop', 'Tell the viewer what they will understand by the end.',
      'frame', 'Give the simple model behind the offer.',
      'proof_demo', 'Show the artifact, workflow, or result that proves the offer is real.',
      'teaching_beats', jsonb_build_array('The cost of staying informal.', 'The operating model that reduces friction.', 'The first action the audience can take.'),
      'cta', 'Point to the workshop interest path or discovery call.',
      'closing_question', 'Ask what part of the operating loop they would fix first.',
      'thumbnail_promise', 'From idea to accountable workflow.',
      'source_distance_notes', 'Default AmaduTown launch pattern; no external creator material required.'
    )
  ),
  (
    'accelerated_lesson',
    'Accelerated lesson',
    'A lesson-video structure for the Accelerated course: pain, concept, proof moment, exercise, next action.',
    'seeded',
    ARRAY[]::TEXT[],
    jsonb_build_object(
      'pain_point', 'Show why speed without judgment creates more noise.',
      'hook', 'Open with the moment where AI makes the work faster but the decision harder.',
      'open_loop', 'Promise a practical way to keep speed and accountability together.',
      'frame', 'Teach the Accelerated operating loop in plain language.',
      'proof_demo', 'Use a Portfolio or AmaduTown workflow as the receipt.',
      'teaching_beats', jsonb_build_array('The speed trap.', 'The decision-first frame.', 'The proof and review loop.'),
      'cta', 'Ask the learner to complete the worksheet or join the workshop interest path.',
      'closing_question', 'Ask which decision in their work needs a clearer loop.',
      'thumbnail_promise', 'AI speed needs an operating layer.',
      'source_distance_notes', 'Course-native template grounded in the Accelerated book and AmaduTown proof.'
    )
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_type = EXCLUDED.source_type,
  source_urls = EXCLUDED.source_urls,
  outline = EXCLUDED.outline,
  status = 'active',
  updated_at = NOW();

COMMENT ON TABLE public.video_script_templates IS
  'Reusable, source-safe video script outline templates. Creator patterns are structure only and must be rewritten in Vambah voice.';

COMMENT ON TABLE public.video_script_evaluations IS
  'Read-only script scorecards for draft review before provider generation gates.';
