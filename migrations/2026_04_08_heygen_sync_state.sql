-- Single-row metadata for the last HeyGen catalog sync (avatars/voices from API).
-- Populated by POST heygen-config action=sync; returned on GET for admin UI.

CREATE TABLE IF NOT EXISTS heygen_sync_state (
  id               TEXT PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  success          BOOLEAN NOT NULL DEFAULT false,
  avatars_synced   INTEGER NOT NULL DEFAULT 0,
  voices_synced    INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE heygen_sync_state IS 'Last HeyGen avatar/voice sync run: timestamp, success, row counts, optional error (single row id=singleton).';
