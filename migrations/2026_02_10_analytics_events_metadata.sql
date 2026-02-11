-- Add metadata and section columns to analytics_events (used by POST /api/analytics)
-- Fixes PGRST204: "Could not find the 'metadata' column of 'analytics_events' in the schema cache"

ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS section TEXT;

COMMENT ON COLUMN analytics_events.metadata IS 'Event-specific payload (e.g. projectTitle, videoTitle, platform)';
COMMENT ON COLUMN analytics_events.section IS 'Page section or context for the event';
