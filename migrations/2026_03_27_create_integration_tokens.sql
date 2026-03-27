-- Integration tokens table for OAuth-based third-party services
-- Stores rotating tokens (e.g. Read.ai) with auto-refresh support

CREATE TABLE IF NOT EXISTS integration_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scopes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider)
);

ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE integration_tokens IS 'Stores OAuth tokens for third-party integrations (Read.ai, etc). Admin-only via supabaseAdmin.';
