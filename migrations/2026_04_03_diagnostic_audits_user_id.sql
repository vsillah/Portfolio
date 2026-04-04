-- Link standalone/chat diagnostics to Supabase Auth user when the user is logged in.
-- Enables "My library" (/purchases) to resolve the user's audit without email-only matching.

ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_user_completed
  ON diagnostic_audits (user_id, completed_at DESC)
  WHERE status = 'completed' AND user_id IS NOT NULL;

COMMENT ON COLUMN diagnostic_audits.user_id IS 'Auth user who owns this audit when captured from a logged-in session; optional.';
