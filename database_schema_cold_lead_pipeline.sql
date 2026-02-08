-- ============================================================================
-- Cold Lead Generation Pipeline - Database Schema
-- Run this SQL in Supabase SQL Editor
-- Adds outbound lead generation tables and extends contact_submissions
-- for automated cold outreach with human-in-the-loop review.
-- ============================================================================

-- ============================================================================
-- 1. Extend contact_submissions with lead source and outreach tracking
-- ============================================================================

-- Lead source: distinguishes inbound vs cold vs warm outreach leads
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'inbound_form'
  CHECK (lead_source IN (
    'inbound_form',              -- Submitted via portfolio contact form
    'inbound_chat',              -- Came through chat/diagnostic flow
    'cold_apollo',               -- Sourced from Apollo.io API
    'cold_linkedin',             -- Sourced from LinkedIn scraping
    'cold_referral',             -- Manual entry / referral for cold outreach
    'cold_google_maps',          -- Sourced from Google Maps (future)
    'warm_facebook_friends',     -- Facebook friends list
    'warm_facebook_groups',      -- Facebook group members
    'warm_facebook_engagement',  -- People who engage with FB posts
    'warm_google_contacts',      -- Google Contacts sync
    'warm_linkedin_connections', -- LinkedIn 1st-degree connections
    'warm_linkedin_engagement'   -- People who engage with LinkedIn posts
  ));

-- Outreach status: tracks where the lead is in the cold outreach funnel
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS outreach_status TEXT DEFAULT 'not_contacted'
  CHECK (outreach_status IN (
    'not_contacted',      -- Not yet reached out
    'sequence_active',    -- Currently in an outreach sequence
    'replied',            -- Prospect replied to outreach
    'booked',             -- Discovery call booked
    'opted_out',          -- Unsubscribed or asked to stop
    'no_response'         -- Completed sequence with no response
  ));

-- Apollo person ID for deduplication
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS apollo_person_id TEXT;

-- LinkedIn profile username (extracted from URL) for matching
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS linkedin_username TEXT;

-- Job title (from Apollo/LinkedIn enrichment)
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Company employee count range
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS employee_count TEXT;

-- Industry classification
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS industry TEXT;

-- Location (city, state/country)
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS location TEXT;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_contact_submissions_lead_source
ON contact_submissions(lead_source);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_outreach_status
ON contact_submissions(outreach_status);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_apollo_person_id
ON contact_submissions(apollo_person_id)
WHERE apollo_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_linkedin_username
ON contact_submissions(linkedin_username)
WHERE linkedin_username IS NOT NULL;

-- Comments for new columns
COMMENT ON COLUMN contact_submissions.lead_source IS 'Origin of the lead: inbound_form, inbound_chat, cold_apollo, cold_linkedin, cold_referral';
COMMENT ON COLUMN contact_submissions.outreach_status IS 'Cold outreach funnel status: not_contacted, sequence_active, replied, booked, opted_out, no_response';
COMMENT ON COLUMN contact_submissions.apollo_person_id IS 'Apollo.io person ID for deduplication across scraping runs';
COMMENT ON COLUMN contact_submissions.linkedin_username IS 'LinkedIn username extracted from profile URL for matching';
COMMENT ON COLUMN contact_submissions.job_title IS 'Job title from Apollo/LinkedIn enrichment';
COMMENT ON COLUMN contact_submissions.employee_count IS 'Company employee count range e.g. 11-50, 51-200';
COMMENT ON COLUMN contact_submissions.industry IS 'Industry classification from Apollo/LinkedIn';
COMMENT ON COLUMN contact_submissions.location IS 'Lead location (city, state/country)';

-- ============================================================================
-- 1b. Warm lead columns on contact_submissions
-- ============================================================================

-- Facebook profile URL for warm leads sourced from Facebook
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS facebook_profile_url TEXT;

-- Phone number (from Google Contacts sync)
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Relationship strength: derived from source type
-- strong = 1st-degree connections, friends
-- moderate = group members, engaged contacts
-- weak = indirect engagement
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS relationship_strength TEXT
  CHECK (relationship_strength IN ('strong', 'moderate', 'weak'));

-- Source detail: e.g. "Tech Founders Group", "Liked post about AI"
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS warm_source_detail TEXT;

-- Indexes for warm lead columns
CREATE INDEX IF NOT EXISTS idx_contact_submissions_facebook_profile
ON contact_submissions(facebook_profile_url)
WHERE facebook_profile_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_phone_number
ON contact_submissions(phone_number)
WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_relationship_strength
ON contact_submissions(relationship_strength)
WHERE relationship_strength IS NOT NULL;

COMMENT ON COLUMN contact_submissions.facebook_profile_url IS 'Facebook profile URL for warm leads sourced from Facebook';
COMMENT ON COLUMN contact_submissions.phone_number IS 'Phone number from Google Contacts sync';
COMMENT ON COLUMN contact_submissions.relationship_strength IS 'Relationship strength: strong (friends/1st-degree), moderate (group members), weak (engagement)';
COMMENT ON COLUMN contact_submissions.warm_source_detail IS 'Detail about warm lead source e.g. group name, post topic';

-- ============================================================================
-- 2. Outreach Sequences - Multi-step sequence templates (created first for FK)
-- Defines the cadence and structure of outreach campaigns.
-- ============================================================================
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  description TEXT,

  -- Target criteria
  target_score_min INTEGER DEFAULT 0,     -- Minimum lead score to use this sequence
  target_score_max INTEGER DEFAULT 100,   -- Maximum lead score
  target_lead_source TEXT[],              -- Which lead sources this applies to

  -- Sequence steps definition
  -- JSONB array of step configs:
  -- [
  --   { "step": 1, "channel": "email", "delay_days": 0, "template_type": "initial_outreach" },
  --   { "step": 2, "channel": "linkedin", "delay_days": 2, "template_type": "connection_request" },
  --   { "step": 3, "channel": "email", "delay_days": 5, "template_type": "follow_up_value" },
  --   { "step": 4, "channel": "email", "delay_days": 10, "template_type": "breakup" }
  -- ]
  steps JSONB NOT NULL DEFAULT '[]',

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Outreach Queue - Human-in-the-loop review table
-- Stores draft messages for admin review before sending.
-- Each row is one message on one channel for one lead.
-- ============================================================================
CREATE TABLE IF NOT EXISTS outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to the lead
  contact_submission_id BIGINT NOT NULL REFERENCES contact_submissions(id) ON DELETE CASCADE,

  -- Channel and content
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin')),
  subject TEXT,                          -- Email subject (NULL for LinkedIn)
  body TEXT NOT NULL,                    -- Message body (Markdown for email, plain for LinkedIn)

  -- Sequence tracking
  sequence_step INTEGER NOT NULL DEFAULT 1 CHECK (sequence_step BETWEEN 1 AND 6),
  sequence_id UUID REFERENCES outreach_sequences(id) ON DELETE SET NULL,

  -- Status lifecycle: draft -> approved -> sent -> replied/bounced/cancelled
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',        -- AI-generated, awaiting human review
    'approved',     -- Human approved, ready to send
    'sent',         -- Successfully sent
    'replied',      -- Prospect replied to this message
    'bounced',      -- Email bounced / delivery failed
    'cancelled',    -- Cancelled (e.g. lead replied on other channel, opted out)
    'rejected'      -- Human rejected this draft
  )),

  -- Gmail thread tracking for reply detection
  thread_id TEXT,                        -- Gmail thread ID after sending
  message_id TEXT,                       -- Gmail message ID after sending

  -- Approval tracking
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  -- Send tracking
  scheduled_send_at TIMESTAMPTZ,         -- When to send (for scheduled sends)
  sent_at TIMESTAMPTZ,                   -- When actually sent

  -- Reply tracking
  replied_at TIMESTAMPTZ,
  reply_content TEXT,                    -- Content of the reply

  -- AI generation metadata
  generation_model TEXT,                 -- Model used to generate (e.g. gpt-4o)
  generation_prompt_summary TEXT,        -- Brief summary of what was used to generate

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. Cold Lead Sources - ICP search criteria for Apollo/LinkedIn
-- Tracks what searches are being run and their performance.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cold_lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,                     -- Human-readable name e.g. "SaaS CTOs 50-200 employees"
  description TEXT,

  -- Source platform
  platform TEXT NOT NULL CHECK (platform IN ('apollo', 'linkedin', 'google_maps', 'facebook', 'google_contacts')),

  -- Search criteria (platform-specific)
  -- Apollo example:
  -- {
  --   "person_titles": ["CTO", "VP Engineering", "Head of AI"],
  --   "organization_num_employees_ranges": ["11,50", "51,200"],
  --   "person_locations": ["United States"],
  --   "organization_industry_tag_ids": ["saas", "technology"]
  -- }
  -- LinkedIn example:
  -- {
  --   "search_url": "https://linkedin.com/search/results/people/?...",
  --   "keywords": "CTO AI automation"
  -- }
  search_criteria JSONB NOT NULL DEFAULT '{}',

  -- Performance tracking
  total_leads_found INTEGER DEFAULT 0,
  total_leads_qualified INTEGER DEFAULT 0,
  total_leads_replied INTEGER DEFAULT 0,
  total_leads_booked INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_run_leads_count INTEGER DEFAULT 0,

  -- Schedule
  run_frequency TEXT DEFAULT 'weekly' CHECK (run_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'manual')),
  is_active BOOLEAN DEFAULT true,
  max_leads_per_run INTEGER DEFAULT 25,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for outreach_queue
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_outreach_queue_contact
ON outreach_queue(contact_submission_id);

CREATE INDEX IF NOT EXISTS idx_outreach_queue_status
ON outreach_queue(status);

CREATE INDEX IF NOT EXISTS idx_outreach_queue_draft
ON outreach_queue(status, created_at)
WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_outreach_queue_sent
ON outreach_queue(status, contact_submission_id)
WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_outreach_queue_thread
ON outreach_queue(thread_id)
WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_queue_channel_status
ON outreach_queue(channel, status);

CREATE INDEX IF NOT EXISTS idx_outreach_queue_sequence_step
ON outreach_queue(contact_submission_id, sequence_step);

-- Indexes for outreach_sequences
CREATE INDEX IF NOT EXISTS idx_outreach_sequences_active
ON outreach_sequences(is_active)
WHERE is_active = true;

-- Indexes for cold_lead_sources
CREATE INDEX IF NOT EXISTS idx_cold_lead_sources_platform
ON cold_lead_sources(platform);

CREATE INDEX IF NOT EXISTS idx_cold_lead_sources_active
ON cold_lead_sources(is_active)
WHERE is_active = true;

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE outreach_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cold_lead_sources ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies - Admin only access
-- ============================================================================

-- Outreach Queue - Admin only
DROP POLICY IF EXISTS "Admins can manage outreach queue" ON outreach_queue;
CREATE POLICY "Admins can manage outreach queue"
  ON outreach_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Outreach Sequences - Admin only
DROP POLICY IF EXISTS "Admins can manage outreach sequences" ON outreach_sequences;
CREATE POLICY "Admins can manage outreach sequences"
  ON outreach_sequences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Cold Lead Sources - Admin only
DROP POLICY IF EXISTS "Admins can manage cold lead sources" ON cold_lead_sources;
CREATE POLICY "Admins can manage cold lead sources"
  ON cold_lead_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_cold_pipeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outreach_queue_updated_at ON outreach_queue;
CREATE TRIGGER outreach_queue_updated_at
  BEFORE UPDATE ON outreach_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_cold_pipeline_updated_at();

DROP TRIGGER IF EXISTS outreach_sequences_updated_at ON outreach_sequences;
CREATE TRIGGER outreach_sequences_updated_at
  BEFORE UPDATE ON outreach_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_cold_pipeline_updated_at();

DROP TRIGGER IF EXISTS cold_lead_sources_updated_at ON cold_lead_sources;
CREATE TRIGGER cold_lead_sources_updated_at
  BEFORE UPDATE ON cold_lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_cold_pipeline_updated_at();

-- ============================================================================
-- 5. Warm Lead Trigger Audit - Track manual trigger events
-- ============================================================================
CREATE TABLE IF NOT EXISTS warm_lead_trigger_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  source TEXT NOT NULL CHECK (source IN ('facebook', 'google_contacts', 'linkedin', 'all')),
  triggered_by UUID REFERENCES auth.users(id),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Trigger options
  options JSONB DEFAULT '{}',
  
  -- n8n execution tracking
  n8n_execution_id TEXT,
  n8n_workflow_id TEXT,
  
  -- Results
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  leads_found INTEGER DEFAULT 0,
  leads_inserted INTEGER DEFAULT 0,
  error_message TEXT,
  
  completed_at TIMESTAMPTZ
);

-- Indexes for warm_lead_trigger_audit
CREATE INDEX IF NOT EXISTS idx_warm_trigger_audit_source 
ON warm_lead_trigger_audit(source, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_warm_trigger_audit_user 
ON warm_lead_trigger_audit(triggered_by, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_warm_trigger_audit_status
ON warm_lead_trigger_audit(status)
WHERE status IN ('pending', 'running');

COMMENT ON TABLE warm_lead_trigger_audit IS 'Audit log for manual warm lead scraping triggers';
COMMENT ON COLUMN warm_lead_trigger_audit.source IS 'Scraping source: facebook, google_contacts, linkedin, or all';
COMMENT ON COLUMN warm_lead_trigger_audit.options IS 'Trigger options: max_leads, group_uids, profile_url, etc.';
COMMENT ON COLUMN warm_lead_trigger_audit.status IS 'Trigger status: pending, running, success, failed';

-- Enable RLS
ALTER TABLE warm_lead_trigger_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Admin only
DROP POLICY IF EXISTS "Admins can manage warm lead triggers" ON warm_lead_trigger_audit;
CREATE POLICY "Admins can manage warm lead triggers"
  ON warm_lead_trigger_audit FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS warm_lead_trigger_audit_updated_at ON warm_lead_trigger_audit;
CREATE TRIGGER warm_lead_trigger_audit_updated_at
  BEFORE UPDATE ON warm_lead_trigger_audit
  FOR EACH ROW
  EXECUTE FUNCTION update_cold_pipeline_updated_at();

-- ============================================================================
-- Helper Views
-- ============================================================================

-- View: Pending outreach drafts for admin review
CREATE OR REPLACE VIEW outreach_drafts_pending AS
SELECT
  oq.id AS outreach_id,
  oq.channel,
  oq.subject,
  oq.body,
  oq.sequence_step,
  oq.status,
  oq.created_at AS draft_created_at,
  cs.id AS contact_id,
  cs.name AS lead_name,
  cs.email AS lead_email,
  cs.company AS lead_company,
  cs.job_title AS lead_job_title,
  cs.lead_score,
  cs.qualification_status,
  cs.lead_source,
  cs.full_report,
  cs.quick_wins,
  cs.ai_readiness_score,
  cs.competitive_pressure_score
FROM outreach_queue oq
JOIN contact_submissions cs ON oq.contact_submission_id = cs.id
WHERE oq.status = 'draft'
ORDER BY cs.lead_score DESC NULLS LAST, oq.created_at ASC;

COMMENT ON VIEW outreach_drafts_pending IS 'Pending outreach drafts awaiting admin review, joined with lead data for context. Ordered by lead score (highest first).';

-- View: Active outreach sequences per lead
CREATE OR REPLACE VIEW outreach_active_sequences AS
SELECT
  cs.id AS contact_id,
  cs.name AS lead_name,
  cs.email AS lead_email,
  cs.company AS lead_company,
  cs.lead_score,
  cs.outreach_status,
  cs.lead_source,
  COUNT(oq.id) FILTER (WHERE oq.status = 'sent') AS emails_sent,
  COUNT(oq.id) FILTER (WHERE oq.status = 'draft') AS drafts_pending,
  COUNT(oq.id) FILTER (WHERE oq.status = 'replied') AS replies_received,
  MAX(oq.sent_at) AS last_sent_at,
  MAX(oq.sequence_step) FILTER (WHERE oq.status = 'sent') AS current_step,
  MIN(oq.created_at) AS sequence_started_at
FROM contact_submissions cs
JOIN outreach_queue oq ON cs.id = oq.contact_submission_id
WHERE cs.outreach_status = 'sequence_active'
GROUP BY cs.id, cs.name, cs.email, cs.company, cs.lead_score, cs.outreach_status, cs.lead_source
ORDER BY cs.lead_score DESC NULLS LAST;

COMMENT ON VIEW outreach_active_sequences IS 'Active outreach sequences showing per-lead send counts, current step, and pending drafts.';

-- View: Cold lead pipeline funnel metrics
CREATE OR REPLACE VIEW cold_lead_pipeline_metrics AS
SELECT
  lead_source,
  CASE
    WHEN lead_source LIKE 'warm_%' THEN 'warm'
    WHEN lead_source LIKE 'cold_%' THEN 'cold'
    ELSE 'inbound'
  END AS lead_temperature,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE lead_score IS NOT NULL) AS enriched,
  COUNT(*) FILTER (WHERE outreach_status = 'sequence_active') AS contacted,
  COUNT(*) FILTER (WHERE outreach_status = 'replied') AS replied,
  COUNT(*) FILTER (WHERE outreach_status = 'booked') AS booked,
  COUNT(*) FILTER (WHERE outreach_status = 'opted_out') AS opted_out,
  COUNT(*) FILTER (WHERE outreach_status = 'no_response') AS no_response,
  ROUND(
    COUNT(*) FILTER (WHERE outreach_status = 'replied')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE outreach_status IN ('sequence_active', 'replied', 'booked', 'no_response')), 0) * 100,
    1
  ) AS reply_rate_pct,
  ROUND(
    COUNT(*) FILTER (WHERE outreach_status = 'booked')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE outreach_status IN ('sequence_active', 'replied', 'booked', 'no_response')), 0) * 100,
    1
  ) AS booking_rate_pct
FROM contact_submissions
WHERE lead_source LIKE 'cold_%' OR lead_source LIKE 'warm_%'
GROUP BY lead_source
ORDER BY lead_source;

COMMENT ON VIEW cold_lead_pipeline_metrics IS 'Funnel metrics for cold and warm lead sources: total -> enriched -> contacted -> replied -> booked, with conversion rates and lead_temperature.';

-- View: Warm lead pipeline funnel metrics (warm-only convenience view)
DROP VIEW IF EXISTS warm_lead_pipeline_metrics;
CREATE VIEW warm_lead_pipeline_metrics AS
SELECT
  lead_source,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE lead_score IS NOT NULL) AS enriched,
  COUNT(*) FILTER (WHERE outreach_status = 'sequence_active') AS contacted,
  COUNT(*) FILTER (WHERE outreach_status = 'replied') AS replied,
  COUNT(*) FILTER (WHERE outreach_status = 'booked') AS booked,
  COUNT(*) FILTER (WHERE outreach_status = 'opted_out') AS opted_out,
  COUNT(*) FILTER (WHERE outreach_status = 'no_response') AS no_response,
  ROUND(
    COUNT(*) FILTER (WHERE outreach_status = 'replied')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE outreach_status IN ('sequence_active', 'replied', 'booked', 'no_response')), 0) * 100,
    1
  ) AS reply_rate_pct,
  ROUND(
    COUNT(*) FILTER (WHERE outreach_status = 'booked')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE outreach_status IN ('sequence_active', 'replied', 'booked', 'no_response')), 0) * 100,
    1
  ) AS booking_rate_pct
FROM contact_submissions
WHERE lead_source LIKE 'warm_%'
GROUP BY lead_source
ORDER BY lead_source;

COMMENT ON VIEW warm_lead_pipeline_metrics IS 'Funnel metrics for warm lead sources only: total -> enriched -> contacted -> replied -> booked.';

-- Update the qualified_leads view to include new columns
-- Must DROP first because PostgreSQL doesn't allow column reordering via CREATE OR REPLACE
DROP VIEW IF EXISTS qualified_leads;
CREATE VIEW qualified_leads AS
SELECT
  id,
  name,
  email,
  company,
  company_domain,
  linkedin_url,
  annual_revenue,
  interest_summary,
  lead_score,
  ai_readiness_score,
  competitive_pressure_score,
  qualification_status,
  quick_wins,
  key_stakeholders,
  full_report,
  lead_source,
  outreach_status,
  job_title,
  industry,
  calendly_event_uri,
  discovery_call_scheduled,
  discovery_call_completed_at,
  created_at
FROM contact_submissions
WHERE lead_score IS NOT NULL
  AND lead_score >= 40
  AND qualification_status IN ('hot', 'warm', 'qualified')
ORDER BY lead_score DESC, created_at DESC;

COMMENT ON VIEW qualified_leads IS 'Filtered view of contact_submissions showing scored leads (40+) with hot/warm/qualified status. Includes lead_source and outreach_status for pipeline tracking.';
