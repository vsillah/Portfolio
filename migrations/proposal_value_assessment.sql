-- ============================================================================
-- Proposal Value Assessment Integration
-- Adds value evidence columns to the proposals table so that each proposal
-- can link to a value report and cache a snapshot of the assessment data.
-- ============================================================================

-- Add reference to the value report used when generating the proposal
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS value_report_id UUID REFERENCES value_reports(id);

-- Cache the value assessment data at proposal creation time.
-- This JSONB snapshot ensures the proposal remains stable even if the
-- underlying value report is later updated or deleted.
-- Structure:
-- {
--   "totalAnnualValue": 125000,
--   "industry": "marketing_agency",
--   "companySizeRange": "11-50",
--   "valueStatements": [
--     {
--       "painPoint": "Manual Reporting",
--       "painPointId": "uuid",
--       "annualValue": 48000,
--       "calculationMethod": "time_saved",
--       "formulaReadable": "20 hrs/month × $50/hr × 12 months × 80% efficiency",
--       "evidenceSummary": "Based on 5 data points from social_media, diagnostic_audit",
--       "confidence": "high"
--     }
--   ],
--   "roi": 4.2,
--   "roiStatement": "For every $1 invested, you save $4.20"
-- }
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS value_assessment JSONB;

-- Index for querying proposals by their linked value report
CREATE INDEX IF NOT EXISTS idx_proposals_value_report
  ON proposals(value_report_id)
  WHERE value_report_id IS NOT NULL;
