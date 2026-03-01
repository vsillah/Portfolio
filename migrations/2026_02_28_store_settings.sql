-- Store settings (key-value) for admin-configurable store behaviour (e.g. social share reward).
-- Used by: social share message discount display, POST /api/social-share reward amount.

CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default: social share reward $5 fixed (admin can change to percentage in UI)
INSERT INTO store_settings (key, value)
VALUES ('social_share_discount', '{"type": "fixed", "value": 5}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE store_settings IS 'Admin-editable store configuration (social share reward, etc.)';

-- RLS: only backend (service role) can read/write; no policies for anon/auth
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
