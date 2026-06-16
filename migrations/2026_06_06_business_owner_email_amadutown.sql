-- Move Portfolio business-owner routing to the AmaduTown Workspace mailbox.
-- Existing environments should keep recovery/admin access separate from client-facing identity.

INSERT INTO site_settings (key, value, description)
VALUES (
  'business_owner_email',
  '"vambah@amadutown.com"',
  'Primary email for the business owner. Used as reply-to on outbound emails and as the forwarding target for unrecognized inbound replies.'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
