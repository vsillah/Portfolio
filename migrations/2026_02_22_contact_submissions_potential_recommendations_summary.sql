-- Migration: Add potential_recommendations_summary to contact_submissions
-- Date: 2026-02-22
-- Purpose: Store AI-generated recommendations summary from Lead Research workflow (n8n)
-- The workflow's Data Extraction Agent outputs potentialCompanySolutions → this column

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS potential_recommendations_summary TEXT;

COMMENT ON COLUMN contact_submissions.potential_recommendations_summary IS 'Brief summary of recommended AI solutions from Research Agent (populated by n8n Lead Qualification workflow).';
