-- Dedupe table for WF-SLK: one meeting record per Slack event_id.
-- Used by GET/POST /api/slack-meeting-dedupe (n8n calls before/after processing).

CREATE TABLE IF NOT EXISTS slack_meeting_events_processed (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE slack_meeting_events_processed IS 'Slack event_id seen by WF-SLK; prevents duplicate meeting records from retries or duplicate events.';
