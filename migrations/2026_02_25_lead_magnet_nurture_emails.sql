-- ============================================================================
-- Migration: Lead magnet nurture emails tracking table
-- Date: 2026-02-25
-- Purpose: Track each nurture email sent per lead magnet download.
--   Used by the n8n WF-LMN-001 callback to log email delivery status.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_magnet_nurture_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_magnet_download_id UUID REFERENCES lead_magnet_downloads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lead_magnet_id UUID NOT NULL REFERENCES lead_magnets(id) ON DELETE CASCADE,
  email_number INT NOT NULL CHECK (email_number BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed', 'opened', 'clicked')),
  sent_at TIMESTAMPTZ,
  n8n_execution_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nurture_emails_user
  ON lead_magnet_nurture_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_nurture_emails_lead_magnet
  ON lead_magnet_nurture_emails(lead_magnet_id);
CREATE INDEX IF NOT EXISTS idx_nurture_emails_download
  ON lead_magnet_nurture_emails(lead_magnet_download_id);

ALTER TABLE lead_magnet_nurture_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage nurture emails" ON lead_magnet_nurture_emails;
CREATE POLICY "Admins can manage nurture emails"
  ON lead_magnet_nurture_emails FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role full access to nurture emails" ON lead_magnet_nurture_emails;
CREATE POLICY "Service role full access to nurture emails"
  ON lead_magnet_nurture_emails FOR ALL
  USING (true)
  WITH CHECK (true);
