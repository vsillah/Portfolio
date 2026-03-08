-- Site-wide configuration stored in the database so values can be
-- edited from the admin UI without redeploying.

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage site settings" ON site_settings;
CREATE POLICY "Admins can manage site settings"
  ON site_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role full access to site settings" ON site_settings;
CREATE POLICY "Service role full access to site settings"
  ON site_settings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_settings_updated_at ON site_settings;
CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_updated_at();

-- Seed the business owner email
INSERT INTO site_settings (key, value, description) VALUES
  ('business_owner_email', '"vsillah@gmail.com"', 'Primary email for the business owner. Used as reply-to on outbound emails and as the forwarding target for unrecognized inbound replies.')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE site_settings IS 'Key-value store for site-wide configuration. Editable from admin UI.';
