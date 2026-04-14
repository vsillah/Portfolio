-- Per-admin Google OAuth credentials for Gmail API (user-owned drafts).
-- Access only via supabaseAdmin in API routes (RLS enabled, no policies for anon/auth).

CREATE TABLE IF NOT EXISTS admin_gmail_user_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token_cipher text NOT NULL,
  refresh_token_iv text NOT NULL,
  refresh_token_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_gmail_user_credentials IS 'Encrypted Gmail OAuth refresh tokens per admin user. Server-only via service role.';

CREATE INDEX IF NOT EXISTS idx_admin_gmail_user_credentials_updated
  ON admin_gmail_user_credentials(updated_at DESC);

ALTER TABLE admin_gmail_user_credentials ENABLE ROW LEVEL SECURITY;
