-- Phase 1: Admin Email Center index — one row per logged outbound/inbound message.
-- contact_communication_id is a soft link (no FK): some environments may not have
-- contact_communications yet; backfill runs only when that table exists.

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  email_kind TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'linkedin', 'sms', 'chat', 'voice')),

  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,
  contact_communication_id UUID,

  recipient_email TEXT,
  subject TEXT,
  body_preview TEXT NOT NULL DEFAULT '',

  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN (
    'draft', 'queued', 'sending', 'sent', 'failed', 'bounced', 'replied'
  )),

  transport TEXT NOT NULL DEFAULT 'unknown' CHECK (transport IN (
    'gmail_smtp', 'n8n', 'logged_only', 'unknown'
  )),

  source_system TEXT NOT NULL,
  source_id TEXT,

  context_json JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  external_id TEXT,

  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON email_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_contact ON email_messages(contact_submission_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_kind ON email_messages(email_kind);
CREATE INDEX IF NOT EXISTS idx_email_messages_source ON email_messages(source_system, source_id);

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on email_messages" ON email_messages;
CREATE POLICY "Admin full access on email_messages"
  ON email_messages
  FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "Service role bypass on email_messages" ON email_messages;
CREATE POLICY "Service role bypass on email_messages"
  ON email_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contact_communications'
  ) THEN
    INSERT INTO email_messages (
      email_kind,
      channel,
      contact_submission_id,
      contact_communication_id,
      recipient_email,
      subject,
      body_preview,
      direction,
      status,
      transport,
      source_system,
      source_id,
      context_json,
      metadata,
      sent_at,
      created_at
    )
    SELECT
      cc.message_type,
      cc.channel,
      cc.contact_submission_id,
      cc.id,
      cs.email,
      cc.subject,
      LEFT(COALESCE(cc.body, ''), 500),
      cc.direction,
      CASE cc.status
        WHEN 'draft' THEN 'draft'
        WHEN 'queued' THEN 'queued'
        WHEN 'sent' THEN 'sent'
        WHEN 'failed' THEN 'failed'
        WHEN 'bounced' THEN 'bounced'
        WHEN 'replied' THEN 'replied'
        ELSE 'sent'
      END,
      'unknown',
      cc.source_system,
      cc.source_id,
      '{}'::jsonb,
      COALESCE(cc.metadata, '{}'::jsonb),
      cc.sent_at,
      cc.created_at
    FROM contact_communications cc
    LEFT JOIN contact_submissions cs ON cs.id = cc.contact_submission_id
    WHERE NOT EXISTS (
      SELECT 1 FROM email_messages em WHERE em.contact_communication_id = cc.id
    );
  END IF;
END $$;
