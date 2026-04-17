-- Phase 3: Resend as optional transactional provider + webhook-driven statuses on email_messages.

ALTER TABLE email_messages DROP CONSTRAINT IF EXISTS email_messages_status_check;
ALTER TABLE email_messages ADD CONSTRAINT email_messages_status_check CHECK (status IN (
  'draft',
  'queued',
  'sending',
  'sent',
  'failed',
  'bounced',
  'replied',
  'delivered',
  'complained',
  'opened',
  'clicked',
  'delivery_delayed'
));

ALTER TABLE email_messages DROP CONSTRAINT IF EXISTS email_messages_transport_check;
ALTER TABLE email_messages ADD CONSTRAINT email_messages_transport_check CHECK (transport IN (
  'gmail_smtp',
  'n8n',
  'logged_only',
  'unknown',
  'resend'
));
