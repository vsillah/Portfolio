# AmaduTown Email Domain Runbook

## Operating Model

AmaduTown uses a phased hybrid email migration:

- `amadutown.com` is the public business identity.
- Google Workspace is the primary mailbox provider.
- The existing personal Gmail account remains the recovery/admin backbone until cutover validation is complete.
- Portfolio separates client-facing identity from delivery credentials.

## Target Addresses

| Address | Purpose |
| --- | --- |
| `vambah@amadutown.com` | Primary sender and named business mailbox |
| `hello@amadutown.com` | Public intake and general inquiries |
| `clients@amadutown.com` | Active client communication and reply-to |
| `billing@amadutown.com` | Billing, receipts, and payment issues |
| `automation@amadutown.com` | Machine-triggered routing, filters, and workflow tests |

## Phase 1: Google Workspace Setup

1. Confirm ownership/control of `amadutown.com`.
2. Create Google Workspace with `vambah@amadutown.com` as the first user.
3. Add the role aliases listed above.
4. Configure SPF, DKIM, and DMARC for the domain.
5. Keep the personal Gmail account as recovery/admin contact.
6. Validate:
   - send/receive works from `vambah@amadutown.com`
   - every alias routes to the expected mailbox
   - SPF, DKIM, and DMARC pass in a received-message header test

Current setup state:

- Google Workspace user `vambah@amadutown.com` is active.
- Google Admin Console shows `hello@amadutown.com`, `clients@amadutown.com`, `billing@amadutown.com`, and `automation@amadutown.com` as alternate email aliases for the primary user.
- Google Workspace confirmed the domain verification code, Gmail activation, and DKIM code entry.
- Live send/receive and header inspection remain manual QA gates before client-facing cutover.

### Cloudflare DNS Records

Manual verification was used for setup. Do not use automatic registrar/DNS authorization unless a later operator explicitly approves it.

Current Cloudflare records:

| Type | Name | Priority | Value | Purpose |
| --- | --- | --- | --- | --- |
| `TXT` | `@` | n/a | `google-site-verification=...` | Manual Google Workspace domain verification |
| `MX` | `@` | `1` | `smtp.google.com` | Google Workspace Gmail routing |
| `TXT` | `@` | n/a | `v=spf1 include:_spf.google.com ~all` | SPF authorization for Google mail |
| `TXT` | `google._domainkey` | n/a | Google Workspace generated DKIM public key | DKIM signing for Workspace mail |
| `TXT` | `_dmarc` | n/a | `v=DMARC1; p=none; rua=mailto:vambah@amadutown.com` | DMARC monitoring policy |

Public DNS checks should return:

```bash
dig MX amadutown.com +short
dig TXT amadutown.com +short
dig TXT google._domainkey.amadutown.com +short
dig TXT _dmarc.amadutown.com +short
```

Do not paste the full DKIM value into shared notes unless a DNS repair requires it. It is not a password, but it is noisy and should be read from Cloudflare or Google Admin when needed.

## Phase 2: Portfolio Environment

Set these variables in local and deployed environments:

```bash
BUSINESS_FROM_EMAIL=vambah@amadutown.com
BUSINESS_REPLY_TO_EMAIL=clients@amadutown.com
ADMIN_NOTIFICATION_EMAIL=<current preferred admin inbox>
AUTOMATION_INBOUND_EMAIL=automation@amadutown.com
BUSINESS_FROM_NAME=AmaduTown
```

Keep delivery credentials provider-specific:

```bash
GMAIL_USER=<transport mailbox>
GMAIL_APP_PASSWORD=<app password>
RESEND_API_KEY=<optional>
RESEND_FROM_EMAIL=<optional verified sender>
```

`BUSINESS_FROM_EMAIL` is the address clients should see. `GMAIL_USER` is only a transport credential during the hybrid migration.

## Phase 3: n8n Migration

Migrate client-facing workflows first:

- follow-up drafts
- meeting recap drafts
- client update emails
- inbound client reply detection
- agenda/onboarding email workflows

Keep Google Drive and Google Contacts credentials unchanged unless the workflow explicitly needs Workspace-owned data.

Validation in staging:

- Gmail draft workflows create drafts in the Workspace mailbox.
- Send workflows use the AmaduTown sender identity.
- Alias-triggered automations fire only on expected messages.
- Staging workflows do not send to real clients.

## Phase 4: SaaS Login Inventory

Do not bulk-change SaaS login emails. For each service tied to the personal Gmail, classify it as one of:

- keep personal Gmail as owner/recovery
- change login to `vambah@amadutown.com`
- add `vambah@amadutown.com` as secondary/admin
- leave unchanged because it is personal or low-risk

Migrate business-critical client/vendor tools first. Confirm password-manager entries and recovery contacts after every change.

## Phase 5: Cutover And Monitoring

After Workspace, Portfolio, and n8n staging validation pass:

1. Make `vambah@amadutown.com` the default client-facing sender.
2. Add inbox labels/filters for aliases and automation sources.
3. Monitor for at least two weeks:
   - bounces
   - spam placement
   - reply threading
   - n8n failures
   - Portfolio email logs
4. Decide whether to retire personal Gmail from remaining business-facing surfaces only after stable operation.

## Rollback

If branded sending fails:

1. Set `BUSINESS_FROM_EMAIL` to the last verified sender.
2. Set `BUSINESS_REPLY_TO_EMAIL` to the last known-good reply inbox.
3. Keep `GMAIL_USER` and `GMAIL_APP_PASSWORD` unchanged unless the transport credential itself is failing.
4. Disable or pause affected n8n workflows before re-testing sends.
5. Re-run Portfolio email tests and one manual staging send before re-enabling client-facing workflows.
