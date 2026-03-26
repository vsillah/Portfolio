-- Unified contact communications timeline
-- Every outbound/inbound message across all systems logs here.
-- This is a write-behind log, NOT a replacement for outreach_queue or contact_deliveries.

CREATE TABLE IF NOT EXISTS contact_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_submission_id BIGINT NOT NULL REFERENCES contact_submissions(id) ON DELETE CASCADE,

  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'sms', 'chat', 'voice')),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),

  message_type TEXT NOT NULL CHECK (message_type IN (
    'cold_outreach', 'asset_delivery', 'proposal', 'follow_up',
    'nurture', 'reply', 'manual'
  )),

  subject TEXT,
  body TEXT NOT NULL,

  source_system TEXT NOT NULL CHECK (source_system IN (
    'outreach_queue', 'delivery_email', 'proposal', 'nurture', 'heygen', 'manual'
  )),
  source_id TEXT,

  prompt_key TEXT,

  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN (
    'draft', 'queued', 'sent', 'failed', 'bounced', 'replied'
  )),

  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_comms_contact
  ON contact_communications(contact_submission_id);

CREATE INDEX IF NOT EXISTS idx_contact_comms_sent_at
  ON contact_communications(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_comms_source
  ON contact_communications(source_system);

CREATE INDEX IF NOT EXISTS idx_contact_comms_channel
  ON contact_communications(channel);

-- RLS: admin-only via SECURITY DEFINER helper
ALTER TABLE contact_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on contact_communications"
  ON contact_communications
  FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Service role bypass on contact_communications"
  ON contact_communications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- Backfill from outreach_queue (sent, replied, bounced, draft, approved items)
INSERT INTO contact_communications (
  contact_submission_id, channel, direction, message_type,
  subject, body, source_system, source_id,
  status, sent_at, created_at
)
SELECT
  contact_submission_id,
  channel,
  'outbound',
  'cold_outreach',
  subject,
  body,
  'outreach_queue',
  id::text,
  CASE status
    WHEN 'sent' THEN 'sent'
    WHEN 'replied' THEN 'replied'
    WHEN 'bounced' THEN 'bounced'
    WHEN 'draft' THEN 'draft'
    WHEN 'approved' THEN 'queued'
    WHEN 'rejected' THEN 'draft'
    ELSE 'queued'
  END,
  COALESCE(sent_at, created_at),
  created_at
FROM outreach_queue
WHERE status IN ('sent', 'replied', 'bounced', 'draft', 'approved', 'rejected');


-- Backfill from contact_deliveries
INSERT INTO contact_communications (
  contact_submission_id, channel, direction, message_type,
  subject, body, source_system, source_id,
  status, sent_at, created_at
)
SELECT
  contact_submission_id,
  'email',
  'outbound',
  'asset_delivery',
  subject,
  body,
  'delivery_email',
  id::text,
  status,
  sent_at,
  sent_at
FROM contact_deliveries;
