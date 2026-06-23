-- Campaign-aware Social Content calendar.
-- This is the channel-agnostic planning layer for campaign arcs and due gates.
-- Calendar authorization creates internal handoff work only; it does not publish,
-- upload, schedule externally, or call media providers.

CREATE TABLE IF NOT EXISTS public.social_content_calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.attraction_campaigns(id) ON DELETE SET NULL,
  agent_work_item_id UUID REFERENCES public.agent_work_items(id) ON DELETE SET NULL,
  social_content_id UUID REFERENCES public.social_content_queue(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'linkedin'
    CHECK (channel IN ('linkedin', 'youtube_shorts', 'instagram_reels', 'thumbnail')),
  campaign_phase TEXT NOT NULL DEFAULT 'tease'
    CHECK (campaign_phase IN ('tease', 'teach', 'proof', 'offer')),
  title TEXT NOT NULL,
  planned_angle TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  due_status TEXT NOT NULL DEFAULT 'planned'
    CHECK (due_status IN ('planned', 'due_soon', 'due_now', 'past_due', 'completed', 'cancelled')),
  authorization_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (authorization_status IN ('not_required', 'pending', 'authorized', 'rejected', 'expired')),
  authorization_due_at TIMESTAMPTZ,
  last_pinged_at TIMESTAMPTZ,
  autonomy_eligible BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_content_calendar_campaign_id
  ON public.social_content_calendar_items(campaign_id);

CREATE INDEX IF NOT EXISTS idx_social_content_calendar_agent_work_item_id
  ON public.social_content_calendar_items(agent_work_item_id);

CREATE INDEX IF NOT EXISTS idx_social_content_calendar_social_content_id
  ON public.social_content_calendar_items(social_content_id);

CREATE INDEX IF NOT EXISTS idx_social_content_calendar_channel_phase
  ON public.social_content_calendar_items(channel, campaign_phase);

CREATE INDEX IF NOT EXISTS idx_social_content_calendar_schedule
  ON public.social_content_calendar_items(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_social_content_calendar_authorization
  ON public.social_content_calendar_items(authorization_status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_social_content_calendar_due_status
  ON public.social_content_calendar_items(due_status, scheduled_for);

ALTER TABLE public.social_content_calendar_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read social content calendar items"
  ON public.social_content_calendar_items;
CREATE POLICY "Admins can read social content calendar items"
  ON public.social_content_calendar_items
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

DROP POLICY IF EXISTS "Admins can insert social content calendar items"
  ON public.social_content_calendar_items;
CREATE POLICY "Admins can insert social content calendar items"
  ON public.social_content_calendar_items
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

DROP POLICY IF EXISTS "Admins can update social content calendar items"
  ON public.social_content_calendar_items;
CREATE POLICY "Admins can update social content calendar items"
  ON public.social_content_calendar_items
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

DROP POLICY IF EXISTS "Admins can delete social content calendar items"
  ON public.social_content_calendar_items;
CREATE POLICY "Admins can delete social content calendar items"
  ON public.social_content_calendar_items
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_content_calendar_items TO authenticated;
GRANT ALL ON public.social_content_calendar_items TO service_role;

DROP TRIGGER IF EXISTS update_social_content_calendar_items_updated_at
  ON public.social_content_calendar_items;
CREATE TRIGGER update_social_content_calendar_items_updated_at
  BEFORE UPDATE ON public.social_content_calendar_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.social_content_calendar_items IS
  'Channel-agnostic Social Content calendar tied to campaigns, Shaka insights, governed drafts, and due-gate authorization. External publishing remains a separate gate.';

COMMENT ON COLUMN public.social_content_calendar_items.campaign_phase IS
  'Whisper-to-shout campaign phase: tease, teach, proof, or offer.';

COMMENT ON COLUMN public.social_content_calendar_items.authorization_status IS
  'Human due-gate state. Authorized means internal draft handoff may be prepared, not externally published.';

COMMENT ON COLUMN public.social_content_calendar_items.autonomy_eligible IS
  'Future autonomy metadata only. Defaults false and does not activate execution.';
