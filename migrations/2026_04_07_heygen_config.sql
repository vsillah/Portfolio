-- Stores synced HeyGen assets (avatars, voices) with a per-type default selection.
-- Replaces hardcoded HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID env vars with DB-managed defaults.

CREATE TABLE IF NOT EXISTS heygen_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type  TEXT NOT NULL CHECK (asset_type IN ('avatar', 'voice')),
  asset_id    TEXT NOT NULL,
  asset_name  TEXT NOT NULL DEFAULT 'Unknown',
  is_default  BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB DEFAULT '{}',
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (asset_type, asset_id)
);

-- Only one default per asset_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_heygen_config_one_default_per_type
  ON heygen_config (asset_type) WHERE is_default = true;

-- Fast lookup for defaults
CREATE INDEX IF NOT EXISTS idx_heygen_config_defaults
  ON heygen_config (asset_type, is_default) WHERE is_default = true;

COMMENT ON TABLE heygen_config IS 'HeyGen avatars and voices synced from the API; is_default marks the active default for video generation.';
