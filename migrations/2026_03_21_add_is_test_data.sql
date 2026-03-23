-- Add is_test_data flag to all tables that receive data from n8n pipelines.
-- Enables filtering test data out of production dashboards and reliable cleanup.

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

ALTER TABLE public.meeting_records
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

ALTER TABLE public.outreach_queue
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

ALTER TABLE public.sales_sessions
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

ALTER TABLE public.social_content_queue
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

ALTER TABLE public.pain_point_evidence
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

ALTER TABLE public.market_intelligence
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

ALTER TABLE public.cost_events
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

-- Index for fast cleanup and filtering queries
CREATE INDEX IF NOT EXISTS idx_contact_submissions_test_data
  ON public.contact_submissions (is_test_data) WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS idx_client_projects_test_data
  ON public.client_projects (is_test_data) WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS idx_meeting_records_test_data
  ON public.meeting_records (is_test_data) WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS idx_outreach_queue_test_data
  ON public.outreach_queue (is_test_data) WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS idx_sales_sessions_test_data
  ON public.sales_sessions (is_test_data) WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS idx_social_content_queue_test_data
  ON public.social_content_queue (is_test_data) WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS idx_pain_point_evidence_test_data
  ON public.pain_point_evidence (is_test_data) WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS idx_market_intelligence_test_data
  ON public.market_intelligence (is_test_data) WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS idx_cost_events_test_data
  ON public.cost_events (is_test_data) WHERE is_test_data = true;
