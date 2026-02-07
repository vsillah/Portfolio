-- Migration: Add lead qualification fields to contact_submissions table
-- Run this in your Supabase SQL Editor

-- Add company column
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS company TEXT;

-- Add company domain column
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS company_domain TEXT;

-- Add LinkedIn URL column
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Add annual revenue column (stores revenue range code)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS annual_revenue TEXT;

-- Add interest areas column (stores array of interest codes)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS interest_areas TEXT[];

-- Add interest summary column (human-readable string, easier for n8n integration)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS interest_summary TEXT;

-- Add decision maker flag
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS is_decision_maker BOOLEAN DEFAULT FALSE;

-- Add lead score (populated by n8n after qualification)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS lead_score INTEGER;

-- Add potential recommendations (populated by n8n)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS potential_recommendations TEXT[];

-- Add lead qualification status
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'pending';

-- Add full intelligence report (Markdown from Research Agent)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS full_report TEXT;

-- Add AI readiness score (1-10 from Research Agent)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS ai_readiness_score INTEGER;

-- Add competitive pressure score (1-10 from Research Agent)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS competitive_pressure_score INTEGER;

-- Add quick wins summary (90-day opportunities)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS quick_wins TEXT;

-- Add key stakeholders/AI champions identified
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS key_stakeholders TEXT;

-- Discovery call tracking (Calendly integration)
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT;

ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS discovery_call_scheduled TIMESTAMPTZ;

ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS discovery_call_completed_at TIMESTAMPTZ;

-- Add indexes for filtering/searching
CREATE INDEX IF NOT EXISTS idx_contact_submissions_company 
ON contact_submissions(company) 
WHERE company IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_annual_revenue 
ON contact_submissions(annual_revenue) 
WHERE annual_revenue IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_is_decision_maker 
ON contact_submissions(is_decision_maker) 
WHERE is_decision_maker = TRUE;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_lead_score 
ON contact_submissions(lead_score) 
WHERE lead_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_qualification_status 
ON contact_submissions(qualification_status);

-- Add comments for documentation
COMMENT ON COLUMN contact_submissions.company IS 'Company or organization name of the contact (optional)';
COMMENT ON COLUMN contact_submissions.company_domain IS 'Company website domain e.g. company.com (optional)';
COMMENT ON COLUMN contact_submissions.linkedin_url IS 'LinkedIn profile URL of the contact (optional)';
COMMENT ON COLUMN contact_submissions.annual_revenue IS 'Annual revenue range: under_100k, 100k_500k, 500k_1m, 1m_5m, 5m_10m, 10m_50m, over_50m';
COMMENT ON COLUMN contact_submissions.interest_areas IS 'Array of interest codes: consulting, technology, speaking, partnership, investment, other';
COMMENT ON COLUMN contact_submissions.interest_summary IS 'Human-readable summary of interest areas e.g. "Consulting Services, Technology Solutions"';
COMMENT ON COLUMN contact_submissions.is_decision_maker IS 'Whether the contact is a decision maker / budget holder';
COMMENT ON COLUMN contact_submissions.lead_score IS 'Lead score from 0-100 (populated by n8n Lead Scoring Agent)';
COMMENT ON COLUMN contact_submissions.potential_recommendations IS 'AI-generated recommendations (populated by n8n)';
COMMENT ON COLUMN contact_submissions.qualification_status IS 'Status: pending, qualified, hot, warm, cold';
COMMENT ON COLUMN contact_submissions.full_report IS 'Complete Markdown intelligence report from Research Agent';
COMMENT ON COLUMN contact_submissions.ai_readiness_score IS 'AI Readiness Score 1-10 (extracted from Research Agent report)';
COMMENT ON COLUMN contact_submissions.competitive_pressure_score IS 'Competitive AI Pressure Score 1-10 (extracted from Research Agent report)';
COMMENT ON COLUMN contact_submissions.quick_wins IS 'Quick-win AI opportunities with 90-day ROI potential';
COMMENT ON COLUMN contact_submissions.key_stakeholders IS 'Identified AI champions and key decision makers';
COMMENT ON COLUMN contact_submissions.calendly_event_uri IS 'Calendly event URI for the discovery call booking';
COMMENT ON COLUMN contact_submissions.discovery_call_scheduled IS 'Timestamp when the discovery call was scheduled via Calendly';
COMMENT ON COLUMN contact_submissions.discovery_call_completed_at IS 'Timestamp when the discovery call was completed';

-- ============================================================
-- Qualified Leads VIEW
-- Provides a filtered view of contact_submissions for leads
-- that have been scored and qualified (warm + hot leads).
-- ============================================================
CREATE OR REPLACE VIEW qualified_leads AS
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
  calendly_event_uri,
  discovery_call_scheduled,
  discovery_call_completed_at,
  created_at
FROM contact_submissions
WHERE lead_score IS NOT NULL
  AND lead_score >= 40
  AND qualification_status IN ('hot', 'warm', 'qualified')
ORDER BY lead_score DESC, created_at DESC;

COMMENT ON VIEW qualified_leads IS 'Filtered view of contact_submissions showing scored leads (40+) with hot/warm/qualified status. Used as the "qualified leads database" without table duplication.';
