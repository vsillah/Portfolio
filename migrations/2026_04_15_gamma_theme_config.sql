-- Gamma themes: synced catalog from Gamma API with favorites and a single admin default.
-- Replaces one-shot /themes fetches (first page only) with paginated sync + DB-backed picker.

CREATE TABLE IF NOT EXISTS gamma_theme_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id     TEXT NOT NULL,
  theme_name   TEXT NOT NULL DEFAULT 'Unknown',
  is_default   BOOLEAN NOT NULL DEFAULT false,
  is_favorite  BOOLEAN NOT NULL DEFAULT false,
  metadata     JSONB DEFAULT '{}',
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (theme_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gamma_theme_config_one_default
  ON gamma_theme_config ((1)) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_gamma_theme_config_favorites
  ON gamma_theme_config (is_favorite) WHERE is_favorite = true;

COMMENT ON TABLE gamma_theme_config IS 'Gamma workspace themes from API sync; is_default is the admin-selected default for report generation.';

CREATE TABLE IF NOT EXISTS gamma_theme_sync_state (
  id               TEXT PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  success          BOOLEAN NOT NULL DEFAULT false,
  themes_synced    INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gamma_theme_sync_state IS 'Last Gamma /themes paginated sync: timestamp, success, row count, optional error (single row id=singleton).';

ALTER TABLE gamma_theme_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on gamma_theme_config" ON gamma_theme_config;
DROP POLICY IF EXISTS "Service role bypass on gamma_theme_config" ON gamma_theme_config;
CREATE POLICY "Admin full access on gamma_theme_config"
  ON gamma_theme_config FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on gamma_theme_config"
  ON gamma_theme_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE gamma_theme_sync_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on gamma_theme_sync_state" ON gamma_theme_sync_state;
DROP POLICY IF EXISTS "Service role bypass on gamma_theme_sync_state" ON gamma_theme_sync_state;
CREATE POLICY "Admin full access on gamma_theme_sync_state"
  ON gamma_theme_sync_state FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on gamma_theme_sync_state"
  ON gamma_theme_sync_state FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
