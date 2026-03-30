-- ========================================
-- Social Content Extraction Runs
-- ========================================
-- Tracks when the social content extraction workflow (WF-SOC-001) was triggered
-- Follows the same pattern as value_evidence_workflow_runs

CREATE TABLE IF NOT EXISTS public.social_content_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed')),
  meeting_record_id UUID REFERENCES public.meeting_records(id) ON DELETE SET NULL,
  items_inserted INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.social_content_extraction_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON public.social_content_extraction_runs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" ON public.social_content_extraction_runs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for service role" ON public.social_content_extraction_runs
  FOR UPDATE USING (true);

GRANT ALL ON public.social_content_extraction_runs TO authenticated;
GRANT ALL ON public.social_content_extraction_runs TO service_role;

COMMENT ON TABLE public.social_content_extraction_runs IS 'Tracks extraction workflow trigger history for the social content pipeline';
