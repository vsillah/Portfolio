-- RLS for contact_deliveries (when table exists). Split out so prod can apply after 2026_03_25_contact_deliveries lands.
-- Idempotent with main security migration: safe no-op if policies already exist.

ALTER TABLE contact_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on contact_deliveries" ON contact_deliveries;
DROP POLICY IF EXISTS "Service role bypass on contact_deliveries" ON contact_deliveries;
CREATE POLICY "Admin full access on contact_deliveries"
  ON contact_deliveries FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on contact_deliveries"
  ON contact_deliveries FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
