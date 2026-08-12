-- Cross-channel Social Content comment inbox foundation.
-- This migration creates canonical local storage only. It does not call provider
-- APIs, enable external reply submission, or weaken existing human gates.

CREATE TABLE IF NOT EXISTS public.social_comment_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  platform TEXT NOT NULL
    CHECK (platform IN ('linkedin', 'youtube', 'instagram', 'facebook', 'x', 'tiktok')),
  publish_id UUID REFERENCES public.social_content_publishes(id) ON DELETE SET NULL,
  content_id UUID REFERENCES public.social_content_queue(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'partial', 'failed', 'manual_blocked')),
  cursor_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  window_start_at TIMESTAMPTZ,
  window_end_at TIMESTAMPTZ,
  fetched_count INTEGER NOT NULL DEFAULT 0 CHECK (fetched_count >= 0),
  inserted_count INTEGER NOT NULL DEFAULT 0 CHECK (inserted_count >= 0),
  updated_count INTEGER NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.social_content_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_id UUID NOT NULL REFERENCES public.social_content_publishes(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.social_content_queue(id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('linkedin', 'youtube', 'instagram', 'facebook', 'x', 'tiktok')),
  provider TEXT NOT NULL,
  provider_comment_id TEXT NOT NULL,
  provider_parent_comment_id TEXT,
  parent_comment_id UUID REFERENCES public.social_content_comments(id) ON DELETE SET NULL,
  thread_id TEXT,
  record_type TEXT NOT NULL DEFAULT 'comment'
    CHECK (record_type IN ('comment', 'reply')),
  author_public_handle TEXT,
  author_display_name TEXT,
  author_profile_url TEXT,
  author_is_channel_owner BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  comment_url TEXT,
  provider_created_at TIMESTAMPTZ,
  provider_updated_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden', 'deleted', 'held_for_review', 'blocked', 'unknown')),
  classification_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (classification_status IN ('unreviewed', 'needs_response', 'answered', 'spam', 'blocked', 'ignored')),
  classification_reason TEXT,
  sentiment TEXT NOT NULL DEFAULT 'unknown'
    CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed', 'unknown')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  response_approval_state TEXT NOT NULL DEFAULT 'not_required'
    CHECK (response_approval_state IN ('not_required', 'pending', 'approved', 'rejected', 'blocked')),
  reply_submission_state TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (reply_submission_state IN ('not_applicable', 'draft', 'approved', 'submitted', 'failed', 'blocked')),
  proposed_reply_text TEXT,
  approved_reply_text TEXT,
  reply_provider_comment_id TEXT,
  reply_submitted_at TIMESTAMPTZ,
  provider_capability JSONB NOT NULL DEFAULT '{}'::jsonb,
  ingestion_run_id UUID REFERENCES public.social_comment_ingestion_runs(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_content_comments_provider_identity_unique
    UNIQUE (publish_id, provider, provider_comment_id),
  CONSTRAINT social_content_comments_no_external_submission_without_reply
    CHECK (
      reply_submission_state <> 'submitted'
      OR reply_provider_comment_id IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS public.social_comment_provider_capabilities (
  platform TEXT PRIMARY KEY
    CHECK (platform IN ('linkedin', 'youtube', 'instagram', 'facebook', 'x', 'tiktok')),
  provider TEXT NOT NULL,
  capability_status TEXT NOT NULL DEFAULT 'manual'
    CHECK (capability_status IN ('verified', 'manual', 'blocked', 'unsupported')),
  supports_comment_ingestion BOOLEAN NOT NULL DEFAULT false,
  supports_reply_draft BOOLEAN NOT NULL DEFAULT true,
  supports_reply_submission BOOLEAN NOT NULL DEFAULT false,
  supports_permalink BOOLEAN NOT NULL DEFAULT false,
  supports_author_profile BOOLEAN NOT NULL DEFAULT false,
  supports_threading BOOLEAN NOT NULL DEFAULT false,
  supports_cursor BOOLEAN NOT NULL DEFAULT false,
  external_submission_enabled BOOLEAN NOT NULL DEFAULT false,
  gate_notes TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_comment_provider_capabilities_external_submission_off
    CHECK (external_submission_enabled = false)
);

CREATE INDEX IF NOT EXISTS idx_social_comment_ingestion_runs_platform_status
  ON public.social_comment_ingestion_runs(platform, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_comment_ingestion_runs_publish_id
  ON public.social_comment_ingestion_runs(publish_id);

CREATE INDEX IF NOT EXISTS idx_social_comment_ingestion_runs_content_id
  ON public.social_comment_ingestion_runs(content_id);

CREATE INDEX IF NOT EXISTS idx_social_content_comments_publish_id
  ON public.social_content_comments(publish_id);

CREATE INDEX IF NOT EXISTS idx_social_content_comments_content_id
  ON public.social_content_comments(content_id);

CREATE INDEX IF NOT EXISTS idx_social_content_comments_platform_status
  ON public.social_content_comments(platform, status, classification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_content_comments_parent_comment_id
  ON public.social_content_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_social_content_comments_thread_id
  ON public.social_content_comments(platform, thread_id);

ALTER TABLE public.social_comment_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comment_provider_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read social comment ingestion runs"
  ON public.social_comment_ingestion_runs;
CREATE POLICY "Admins can read social comment ingestion runs"
  ON public.social_comment_ingestion_runs
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

DROP POLICY IF EXISTS "Admins can insert social comment ingestion runs"
  ON public.social_comment_ingestion_runs;
CREATE POLICY "Admins can insert social comment ingestion runs"
  ON public.social_comment_ingestion_runs
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

DROP POLICY IF EXISTS "Admins can update social comment ingestion runs"
  ON public.social_comment_ingestion_runs;
CREATE POLICY "Admins can update social comment ingestion runs"
  ON public.social_comment_ingestion_runs
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

DROP POLICY IF EXISTS "Admins can read social content comments"
  ON public.social_content_comments;
CREATE POLICY "Admins can read social content comments"
  ON public.social_content_comments
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

DROP POLICY IF EXISTS "Admins can insert social content comments"
  ON public.social_content_comments;
CREATE POLICY "Admins can insert social content comments"
  ON public.social_content_comments
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

DROP POLICY IF EXISTS "Admins can update social content comments"
  ON public.social_content_comments;
CREATE POLICY "Admins can update social content comments"
  ON public.social_content_comments
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

DROP POLICY IF EXISTS "Admins can delete social content comments"
  ON public.social_content_comments;
CREATE POLICY "Admins can delete social content comments"
  ON public.social_content_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can read social comment provider capabilities"
  ON public.social_comment_provider_capabilities;
CREATE POLICY "Admins can read social comment provider capabilities"
  ON public.social_comment_provider_capabilities
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

DROP POLICY IF EXISTS "Admins can update social comment provider capabilities"
  ON public.social_comment_provider_capabilities;
CREATE POLICY "Admins can update social comment provider capabilities"
  ON public.social_comment_provider_capabilities
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

GRANT SELECT, INSERT, UPDATE ON public.social_comment_ingestion_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_content_comments TO authenticated;
GRANT SELECT, UPDATE ON public.social_comment_provider_capabilities TO authenticated;
GRANT ALL ON public.social_comment_ingestion_runs TO service_role;
GRANT ALL ON public.social_content_comments TO service_role;
GRANT ALL ON public.social_comment_provider_capabilities TO service_role;

DROP TRIGGER IF EXISTS update_social_comment_ingestion_runs_updated_at
  ON public.social_comment_ingestion_runs;
CREATE TRIGGER update_social_comment_ingestion_runs_updated_at
  BEFORE UPDATE ON public.social_comment_ingestion_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_content_comments_updated_at
  ON public.social_content_comments;
CREATE TRIGGER update_social_content_comments_updated_at
  BEFORE UPDATE ON public.social_content_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_comment_provider_capabilities_updated_at
  ON public.social_comment_provider_capabilities;
CREATE TRIGGER update_social_comment_provider_capabilities_updated_at
  BEFORE UPDATE ON public.social_comment_provider_capabilities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.social_comment_provider_capabilities (
  platform,
  provider,
  capability_status,
  supports_comment_ingestion,
  supports_reply_draft,
  supports_reply_submission,
  supports_permalink,
  supports_author_profile,
  supports_threading,
  supports_cursor,
  external_submission_enabled,
  gate_notes,
  metadata
)
VALUES
  (
    'linkedin',
    'linkedin_organization',
    'manual',
    false,
    true,
    false,
    true,
    true,
    true,
    false,
    false,
    'Foundation only. LinkedIn comments may be entered or ingested later after provider authorization; external replies remain blocked.',
    '{"source":"comment_inbox_foundation"}'::jsonb
  ),
  (
    'youtube',
    'youtube_data_api',
    'manual',
    false,
    true,
    false,
    true,
    true,
    true,
    true,
    false,
    'Foundation only. YouTube API ingestion/reply permissions are not activated by this migration.',
    '{"source":"comment_inbox_foundation"}'::jsonb
  ),
  (
    'instagram',
    'meta_graph',
    'manual',
    false,
    true,
    false,
    true,
    true,
    true,
    true,
    false,
    'Foundation only. Instagram comment permissions require a separate Meta provider gate.',
    '{"source":"comment_inbox_foundation"}'::jsonb
  ),
  (
    'facebook',
    'meta_graph',
    'manual',
    false,
    true,
    false,
    true,
    true,
    true,
    true,
    false,
    'Foundation only. Facebook comment permissions require a separate Meta provider gate.',
    '{"source":"comment_inbox_foundation"}'::jsonb
  ),
  (
    'x',
    'x_api',
    'manual',
    false,
    true,
    false,
    true,
    true,
    true,
    true,
    false,
    'Foundation only. X comment ingestion/reply execution remains disabled pending provider authorization.',
    '{"source":"comment_inbox_foundation"}'::jsonb
  ),
  (
    'tiktok',
    'tiktok_api',
    'blocked',
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    false,
    'Foundation only. TikTok comment automation is represented for planning but blocked until verified.',
    '{"source":"comment_inbox_foundation"}'::jsonb
  )
ON CONFLICT (platform) DO UPDATE
SET provider = EXCLUDED.provider,
    capability_status = EXCLUDED.capability_status,
    supports_comment_ingestion = EXCLUDED.supports_comment_ingestion,
    supports_reply_draft = EXCLUDED.supports_reply_draft,
    supports_reply_submission = EXCLUDED.supports_reply_submission,
    supports_permalink = EXCLUDED.supports_permalink,
    supports_author_profile = EXCLUDED.supports_author_profile,
    supports_threading = EXCLUDED.supports_threading,
    supports_cursor = EXCLUDED.supports_cursor,
    external_submission_enabled = false,
    gate_notes = EXCLUDED.gate_notes,
    metadata = COALESCE(public.social_comment_provider_capabilities.metadata, '{}'::jsonb) || EXCLUDED.metadata;

COMMENT ON TABLE public.social_comment_ingestion_runs IS
  'Read-only/local tracking for comment inbox ingestion attempts. Provider calls and external reply submission remain separate approval-gated workflows.';

COMMENT ON TABLE public.social_content_comments IS
  'Canonical local comment and reply storage tied to Social Content publish records, with provider identity idempotency and human-gated response metadata.';

COMMENT ON TABLE public.social_comment_provider_capabilities IS
  'Per-platform comment inbox capability flags. All external submission remains disabled by constraint in this foundation migration.';

COMMENT ON COLUMN public.social_content_comments.response_approval_state IS
  'Human response approval state for internal reply drafting. Approval here does not submit a reply externally.';

COMMENT ON COLUMN public.social_content_comments.reply_submission_state IS
  'Local submission tracking only. This lane does not enable provider reply submission.';
