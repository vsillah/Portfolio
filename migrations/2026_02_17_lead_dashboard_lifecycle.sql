-- Migration: Lead Dashboard Lifecycle
-- Extends client_dashboard_access to support lead-stage access (keyed by diagnostic_audit_id)
-- and adds questions_by_category to diagnostic_audits for "what will strengthen confidence".
-- One URL works from lead through client; same token after conversion.

-- ============================================================================
-- 1. diagnostic_audits: store questions per category for lead dashboard
-- ============================================================================
ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS questions_by_category JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN diagnostic_audits.questions_by_category IS 'Questions asked per category, e.g. {"business_challenges": ["Q1?", "Q2?"], "tech_stack": ["Q3?"]}. Used by lead dashboard "what will strengthen confidence".';

-- ============================================================================
-- 2. client_dashboard_access: support lead-stage (diagnostic_audit_id) and client (client_project_id)
-- ============================================================================

-- Add lead-stage anchor (nullable). diagnostic_audits.id is BIGINT in this project.
ALTER TABLE client_dashboard_access
  ADD COLUMN IF NOT EXISTS diagnostic_audit_id BIGINT REFERENCES diagnostic_audits(id) ON DELETE CASCADE;

-- Make client_project_id nullable so a row can be lead-only until conversion
ALTER TABLE client_dashboard_access
  ALTER COLUMN client_project_id DROP NOT NULL;

-- At least one of diagnostic_audit_id or client_project_id must be set
ALTER TABLE client_dashboard_access
  DROP CONSTRAINT IF EXISTS chk_dashboard_access_anchor;

ALTER TABLE client_dashboard_access
  ADD CONSTRAINT chk_dashboard_access_anchor CHECK (
    (diagnostic_audit_id IS NOT NULL) OR (client_project_id IS NOT NULL)
  );

-- One lead dashboard per diagnostic (when using diagnostic_audit_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_access_diagnostic_audit
  ON client_dashboard_access(diagnostic_audit_id)
  WHERE diagnostic_audit_id IS NOT NULL;

COMMENT ON COLUMN client_dashboard_access.diagnostic_audit_id IS 'Set for lead-stage dashboard; same row gets client_project_id set at conversion so one URL works for full lifecycle.';
