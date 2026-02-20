-- Chat escalations: source of truth for chatbot escalations (request human / inadequate response)
-- Apply after chat_sessions and contact_submissions exist.

CREATE TABLE IF NOT EXISTS chat_escalations (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL CHECK (source IN ('text', 'voice')),
  reason TEXT,
  visitor_name TEXT,
  visitor_email TEXT,
  transcript TEXT,
  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,
  slack_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE chat_escalations IS 'Chat/voice escalations when user requests human or bot cannot adequately respond; linked to lead for continuity.';
COMMENT ON COLUMN chat_escalations.session_id IS 'Matches chat_sessions.session_id (no FK to avoid circular dependency).';
COMMENT ON COLUMN chat_escalations.source IS 'Channel: text (chat) or voice (VAPI).';
COMMENT ON COLUMN chat_escalations.reason IS 'e.g. user_requested_human, fallback, transfer_to_human.';
COMMENT ON COLUMN chat_escalations.contact_submission_id IS 'Linked lead; auto-set by email when possible, admin can change.';
COMMENT ON COLUMN chat_escalations.slack_sent_at IS 'Set after Slack webhook POST succeeds (audit).';

CREATE INDEX IF NOT EXISTS idx_chat_escalations_session_id ON chat_escalations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_escalations_escalated_at ON chat_escalations(escalated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_escalations_contact_submission_id ON chat_escalations(contact_submission_id) WHERE contact_submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_escalations_visitor_email ON chat_escalations(LOWER(visitor_email)) WHERE visitor_email IS NOT NULL AND visitor_email != '';

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_chat_escalation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_escalation_updated_at ON chat_escalations;
CREATE TRIGGER trigger_update_chat_escalation_updated_at
  BEFORE UPDATE ON chat_escalations
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_escalation_updated_at();
