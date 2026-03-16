-- ============================================================================
-- Migration: Contract PDF and contract signature on proposals
-- Date: 2026-03-16
-- Purpose: Support separate Software Agreement (contract) PDF with its own
--          signature flow; contract_signed_at/contract_signed_by_name for audit.
-- ============================================================================

-- Contract PDF URL (generated with proposal, stored in Storage)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;

-- Contract signature (captured when client signs the contract in same session as proposal)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_signed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS contract_signed_ip TEXT;

COMMENT ON COLUMN proposals.contract_pdf_url IS 'URL of the generated Software Agreement (contract) PDF; generated with proposal.';
COMMENT ON COLUMN proposals.contract_signed_at IS 'When the client signed the contract (separate from proposal signed_at).';
COMMENT ON COLUMN proposals.contract_signed_by_name IS 'Full name used when signing the contract.';
COMMENT ON COLUMN proposals.contract_signed_ip IS 'Optional: client IP when signing contract, for audit.';

-- Optional: copy contract_pdf_url to client_projects for dashboard (avoids join through proposal)
ALTER TABLE client_projects
  ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;

COMMENT ON COLUMN client_projects.contract_pdf_url IS 'Copy of proposal contract_pdf_url for client portal documents; set when project is created from paid proposal.';
