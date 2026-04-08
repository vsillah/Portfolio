-- Supabase security advisor: rls_disabled_in_public + sensitive_columns_exposed (chat_escalations.session_id).
-- Server paths use supabaseAdmin (service role); admin UI uses authenticated admin — mirror contact_communications.
-- contact_deliveries: see 2026_04_08_rls_contact_deliveries_policies.sql (runs after contact_deliveries table exists).

-- chat_escalations
ALTER TABLE chat_escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on chat_escalations" ON chat_escalations;
DROP POLICY IF EXISTS "Service role bypass on chat_escalations" ON chat_escalations;
CREATE POLICY "Admin full access on chat_escalations"
  ON chat_escalations FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on chat_escalations"
  ON chat_escalations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- gamma_reports
ALTER TABLE gamma_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on gamma_reports" ON gamma_reports;
DROP POLICY IF EXISTS "Service role bypass on gamma_reports" ON gamma_reports;
CREATE POLICY "Admin full access on gamma_reports"
  ON gamma_reports FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on gamma_reports"
  ON gamma_reports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- heygen_config
ALTER TABLE heygen_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on heygen_config" ON heygen_config;
DROP POLICY IF EXISTS "Service role bypass on heygen_config" ON heygen_config;
CREATE POLICY "Admin full access on heygen_config"
  ON heygen_config FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on heygen_config"
  ON heygen_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- heygen_sync_state
ALTER TABLE heygen_sync_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on heygen_sync_state" ON heygen_sync_state;
DROP POLICY IF EXISTS "Service role bypass on heygen_sync_state" ON heygen_sync_state;
CREATE POLICY "Admin full access on heygen_sync_state"
  ON heygen_sync_state FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on heygen_sync_state"
  ON heygen_sync_state FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- module_sync_config
ALTER TABLE module_sync_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on module_sync_config" ON module_sync_config;
DROP POLICY IF EXISTS "Service role bypass on module_sync_config" ON module_sync_config;
CREATE POLICY "Admin full access on module_sync_config"
  ON module_sync_config FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on module_sync_config"
  ON module_sync_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- module_sync_custom
ALTER TABLE module_sync_custom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on module_sync_custom" ON module_sync_custom;
DROP POLICY IF EXISTS "Service role bypass on module_sync_custom" ON module_sync_custom;
CREATE POLICY "Admin full access on module_sync_custom"
  ON module_sync_custom FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on module_sync_custom"
  ON module_sync_custom FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- slack_meeting_events_processed
ALTER TABLE slack_meeting_events_processed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on slack_meeting_events_processed" ON slack_meeting_events_processed;
DROP POLICY IF EXISTS "Service role bypass on slack_meeting_events_processed" ON slack_meeting_events_processed;
CREATE POLICY "Admin full access on slack_meeting_events_processed"
  ON slack_meeting_events_processed FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on slack_meeting_events_processed"
  ON slack_meeting_events_processed FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- integration_tokens: RLS was enabled with no policies (advisor lint 0008)
DROP POLICY IF EXISTS "Admin full access on integration_tokens" ON integration_tokens;
DROP POLICY IF EXISTS "Service role bypass on integration_tokens" ON integration_tokens;
CREATE POLICY "Admin full access on integration_tokens"
  ON integration_tokens FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on integration_tokens"
  ON integration_tokens FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
