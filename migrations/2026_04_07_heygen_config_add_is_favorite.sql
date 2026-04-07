-- Add favorites support so admins can filter to their preferred avatars/voices.
ALTER TABLE heygen_config ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_heygen_config_favorites ON heygen_config (asset_type, is_favorite) WHERE is_favorite = true;
