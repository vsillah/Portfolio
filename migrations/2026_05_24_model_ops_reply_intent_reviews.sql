-- Model Ops reply-intent review ledger.
-- Stores sanitized labels for real outreach replies. Raw reply content remains
-- in outreach_queue and is not duplicated here.

CREATE TABLE IF NOT EXISTS public.model_ops_reply_intent_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL DEFAULT 'outreach_queue'
    CHECK (source_table = 'outreach_queue'),
  source_id UUID NOT NULL,
  source_hash TEXT NOT NULL,
  reply_hash TEXT NOT NULL,
  channel TEXT,
  replied_at TIMESTAMPTZ,
  outreach_status TEXT,
  sequence_step INTEGER,
  redacted_reply TEXT NOT NULL,
  suggested_labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'reviewed', 'unsure', 'skipped')),
  human_scheduling_intent BOOLEAN,
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT model_ops_reply_intent_reviews_unique_source
    UNIQUE (source_table, source_id),
  CONSTRAINT model_ops_reply_intent_reviews_reviewed_label_check
    CHECK (review_status <> 'reviewed' OR human_scheduling_intent IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_model_ops_reply_intent_reviews_status
ON public.model_ops_reply_intent_reviews(review_status, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_ops_reply_intent_reviews_source
ON public.model_ops_reply_intent_reviews(source_table, source_id);

CREATE INDEX IF NOT EXISTS idx_model_ops_reply_intent_reviews_reply_hash
ON public.model_ops_reply_intent_reviews(reply_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_ops_reply_intent_reviews TO service_role;

ALTER TABLE public.model_ops_reply_intent_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage model ops reply intent reviews"
ON public.model_ops_reply_intent_reviews;
CREATE POLICY "Admins can manage model ops reply intent reviews"
  ON public.model_ops_reply_intent_reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role can manage model ops reply intent reviews"
ON public.model_ops_reply_intent_reviews;
CREATE POLICY "Service role can manage model ops reply intent reviews"
  ON public.model_ops_reply_intent_reviews FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS model_ops_reply_intent_reviews_updated_at
ON public.model_ops_reply_intent_reviews;
CREATE TRIGGER model_ops_reply_intent_reviews_updated_at
  BEFORE UPDATE ON public.model_ops_reply_intent_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cold_pipeline_updated_at();

COMMENT ON TABLE public.model_ops_reply_intent_reviews
IS 'Sanitized human review ledger for Model Ops reply-intent evaluation labels.';

COMMENT ON COLUMN public.model_ops_reply_intent_reviews.redacted_reply
IS 'PII-redacted reply text used for admin review and benchmark export. Raw reply content stays in outreach_queue.';
