-- Module Sync: custom modules (discovered via scan, create-repo adds here).
-- portfolio_path is unique; code-defined paths cannot be duplicated as custom.

CREATE TABLE IF NOT EXISTS module_sync_custom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  portfolio_path TEXT NOT NULL UNIQUE,
  spun_off_repo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

COMMENT ON TABLE module_sync_custom IS 'Custom Module Sync entries added via Discover spin-offs (scan + create repo). Path must not duplicate code-defined modules.';
