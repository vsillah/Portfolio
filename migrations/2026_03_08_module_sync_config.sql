-- Module Sync: per-module config (spun-off repo URL) editable in Admin UI.
-- Module list (id, name, portfolio_path) stays in code; this table stores overrides.

CREATE TABLE IF NOT EXISTS module_sync_config (
  module_id TEXT PRIMARY KEY,
  spun_off_repo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE module_sync_config IS 'Admin-editable config for Module Sync: GitHub repo URL per module (id matches lib/module-sync-config.ts).';
