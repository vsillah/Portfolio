# n8n Gmail Credential Replacement Proof

Prepared: 2026-06-24
Smoke ID: `revenue_reply_smoke_20260624Tcredential_verify_01`
Decision: **Sender identity fixed; CLG-004 reply tracking passed; GDR draft gate pending**

## Summary

The n8n Gmail OAuth credential used by the revenue outreach workflows was reconnected through the n8n UI after Google OAuth approval.

Controlled smoke proof now shows outbound mail from:

`Vambah Sillah <vambah@amadutown.com>`

This resolves the hard no-go from the earlier smoke, where the same workflow sent from the personal Gmail identity.

## Credential Scope Checked

All live workflow nodes below still use n8n credential `3i9UqJWlIk3ETGLg` named `Gmail account`:

| Workflow | Live ID | Node(s) checked | Result |
| --- | --- | --- | --- |
| `WF-CLG-003: Send and Follow-Up` | `l4iaJwxbeMlR7pTr` | `Send Email via Gmail` | Uses shared Gmail credential. |
| `WF-CLG-004: Reply Detection and Notification` | `i2IGVOYWcpxFidpf` | `New Email Received` | Uses shared Gmail credential; polls every 30 minutes. |
| `WF-GDR: Gmail Draft Reply` | `zXfZmgqM6g1teIMY` | `Gmail Trigger`, `Create Gmail Draft`, `Forward to Owner` | Uses shared Gmail credential; main trigger polls every 4 hours. |

## Smoke Evidence

Synthetic production test data:

| Artifact | ID |
| --- | --- |
| Contact | `13767` |
| Outreach queue row | `794d9e99-d0af-41ff-859f-2863e65885aa` |

Execution evidence:

- Triggered `WF-CLG-003` via webhook path `clg-send`.
- n8n execution `18282` completed successfully.
- The outreach queue row moved to `status='sent'`.
- The row captured Gmail `thread_id='19ef9d0d9700862a'`.
- The row captured Gmail `message_id='19ef9d0d9700862a'`.
- The controlled inbox received the smoke email.
- Gmail search showed sender `Vambah Sillah <vambah@amadutown.com>`.

## Current Go/No-Go

The mailbox sender-identity blocker is resolved.

The first five-contact batch should still wait for one reply-loop smoke before broad send approval.

The first controlled reply was sent after the credential proof, and `WF-CLG-004` did run at `2026-06-24T13:30:55Z`. That execution saw the inbound reply and extracted thread ID `19ef9d0d9700862a`, but `Match Against Outreach` returned zero rows.

Root cause found:

- The Supabase lookup filter was stored as a literal string instead of a n8n expression.
- The sender extractor only checked lowercase `from`, while the Gmail trigger emitted uppercase `From`.
- The downstream Supabase update nodes needed explicit ID expressions for the matched outreach row and contact row.

Live CLG-004 patch applied at `2026-06-24T13:34:11Z`:

- `Extract Sender Email` now reads `from`, `From`, or `headers.from`.
- `Match Against Outreach` now uses expression filter `thread_id=eq.<thread_id>&status=eq.sent`.
- `Get Full Lead Context` now fetches `contact_submissions.id` from `contact_submission_id`.
- `Mark Outreach as Replied` now updates the matched outreach row ID.
- `Update Contact Status` now updates the fetched contact row ID.

Result after that patch:

- `WF-CLG-004` execution `18287` ran at `2026-06-24T14:00:36Z`.
- `Match Against Outreach` succeeded and returned the synthetic outreach row.
- The workflow then failed at `Get Full Lead Context` with `At least one select condition must be defined`.

Second live CLG-004 patch applied at `2026-06-24T14:03:02Z`:

- `Get Full Lead Context` now uses `getAll`, `limit=1`, and expression filter `id=eq.<contact_submission_id>`.

A third controlled internal reply was sent after that patch so the next `WF-CLG-004` poll can process a fresh message.

Result after that patch:

- `WF-CLG-004` execution `18289` ran at `2026-06-24T14:30:33Z`.
- `Match Against Outreach` succeeded.
- `Get Full Lead Context` succeeded.
- The workflow then failed at `Mark Outreach as Replied` with `At least one select condition must be defined`.

Third live CLG-004 patch applied at `2026-06-24T14:33:26Z`:

- `Mark Outreach as Replied` now uses `matchType=allFilters` and an explicit `id=eq.<matched outreach id>` filter.
- `Update Contact Status` now uses `matchType=allFilters` and an explicit `id=eq.<contact id>` filter.

Result after that patch:

- A fourth controlled internal reply was sent at `2026-06-24T15:27:17Z`.
- `WF-CLG-004` execution `18294` ran at `2026-06-24T15:30:00Z`.
- `New Email Received` detected the reply.
- `Extract Sender Email` parsed the internal owner mailbox and thread ID `19ef9d0d9700862a`.
- `Match Against Outreach` returned the synthetic outreach row.
- `Get Full Lead Context` returned the synthetic contact.
- `Mark Outreach as Replied` updated outreach row `794d9e99-d0af-41ff-859f-2863e65885aa` to `status='replied'`.
- `Update Contact Status` updated contact `13767` to `outreach_status='replied'`.
- `Slack DM: Reply Alert` succeeded.
- `Slack Channel: Warm Reply` succeeded.

Database verification after execution `18294`:

- Outreach `status='replied'`.
- Outreach `replied_at='2026-06-24T15:30:04.112Z'`.
- Contact `outreach_status='replied'`.

The remaining launch gate is:

1. Confirm `WF-GDR` creates the Gmail draft and approval alert.
2. Confirm no reply is sent without the explicit `safe to send` approval phrase.

## Notes

- The smoke contact and outreach row are marked `is_test_data=true`.
- `WF-GDR` remains on the user-approved 4-hour cadence.
- No customer-facing lead was contacted during this credential proof.
