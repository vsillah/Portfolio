-- ============================================================================
-- Proposal Access Code, Electronic Signature, and Onboarding Approval
-- Phase 1: access_code for code-based proposal access
-- Phase 2: signature columns for electronic signing
-- Phase 3: onboarding_email_sent_at for admin approval gate
-- ============================================================================

-- Phase 1: Access code (6-char, shareable, unique)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_proposals_access_code
  ON proposals(access_code)
  WHERE access_code IS NOT NULL;

-- Phase 2: Electronic signature
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS signed_ip TEXT,
  ADD COLUMN IF NOT EXISTS signature_data JSONB;

-- Phase 3: Onboarding email approval gate
-- NULL = draft ready, awaiting admin approval
-- Set = email was sent (webhook fired)
ALTER TABLE client_projects
  ADD COLUMN IF NOT EXISTS onboarding_email_sent_at TIMESTAMPTZ;
