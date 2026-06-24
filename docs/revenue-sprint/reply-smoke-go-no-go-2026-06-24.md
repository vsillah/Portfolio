# Revenue Reply Smoke Go/No-Go Packet

Prepared: 2026-06-24
Smoke ID: `revenue_reply_smoke_20260624T130723Z`
Decision: **No-go for the first five-contact batch**

Update: the sender-identity blocker was corrected later on 2026-06-24. See `docs/revenue-sprint/gmail-credential-replacement-2026-06-24.md` for the replacement proof. The first five-contact batch still needs the reply-loop smoke before send approval.

## Summary

The controlled smoke reached the outbound send step and exposed a hard blocker:

`WF-CLG-003: Send and Follow-Up` is using the same n8n Gmail credential as the reply workflows, but the actual smoke email was sent from the personal Gmail identity, not `vambah@amadutown.com`.

That means the reply loop cannot be treated as customer-facing ready yet, even though the send workflow, thread capture, and database update path worked for the synthetic test row.

## Smoke Path

Live workflows checked:

| Workflow | Live ID | Purpose |
| --- | --- | --- |
| `WF-CLG-003: Send and Follow-Up` | `l4iaJwxbeMlR7pTr` | Sends approved outreach and captures Gmail `thread_id`. |
| `WF-CLG-004: Reply Detection and Notification` | `i2IGVOYWcpxFidpf` | Detects replies and matches by `outreach_queue.thread_id`. |
| `WF-GDR: Gmail Draft Reply` | `zXfZmgqM6g1teIMY` | Drafts replies and posts approval alerts. |

Synthetic production test data:

| Artifact | ID |
| --- | --- |
| Contact | `13766` |
| Outreach queue row | `59573151-ed15-4653-8ed0-13021b050dac` |

The test row was created with `is_test_data=true`, `sequence_step=3`, and an approved email draft. Step 3 avoided CLG-003's four-day follow-up wait branch.

## Evidence

Pass:

- `WF-CLG-003` accepted the controlled webhook payload.
- n8n execution `18281` completed successfully.
- The synthetic outreach row moved to `status='sent'`.
- The row captured Gmail `thread_id='19ef9bfa929e1a25'`.
- The row captured `message_id='19ef9bfa929e1a25'`.
- The controlled inbox received the smoke email.

Fail:

- The received smoke email showed the sender as the personal Gmail identity, not `vambah@amadutown.com`.

Not run:

- The reply step was not sent.
- `WF-CLG-004` reply matching was not allowed to proceed.
- `WF-GDR` draft generation was not allowed to proceed.

Reason:

Continuing the smoke after the sender identity failed would only prove a loop for the wrong mailbox. It would not prove the customer-facing AmaduTown communication path.

## Original Go/No-Go

At the time of this smoke, the five-contact batch was **not safe to run**.

The blocker was not copy quality, lead selection, or the reply cadence. The blocker was sender identity:

Customer-facing revenue outreach must come from, and route replies through, `vambah@amadutown.com`.

The live n8n Gmail credential used by:

- `WF-CLG-003`
- `WF-CLG-004`
- `WF-GDR`

had to be reconnected or replaced with the Workspace Gmail account for `vambah@amadutown.com`.

## Current Status After Remediation

Sender identity was corrected later on 2026-06-24. The replacement smoke showed outbound mail from `Vambah Sillah <vambah@amadutown.com>`.

The remaining no-go item is the reply-loop smoke:

- `WF-CLG-004` must detect and mark a controlled reply.
- `WF-GDR` must create and alert a draft.
- No external reply can send without the explicit `safe to send` approval phrase.

## Required Remediation

Completed:

1. Reconnected Gmail credential `3i9UqJWlIk3ETGLg` using `vambah@amadutown.com`.
2. Confirmed the same credential remains attached to:
   - `WF-CLG-003` Gmail send node,
   - `WF-CLG-004` Gmail trigger node,
   - `WF-GDR` Gmail trigger node,
   - `WF-GDR` Gmail draft node,
   - owner-forwarding Gmail node in `WF-GDR`.
3. Re-ran a controlled outbound smoke with a fresh synthetic queue row.
4. Confirmed the outbound smoke email sender is `vambah@amadutown.com`.

Still required:

1. Send a controlled reply and verify:
   - CLG-004 marks the outreach row `replied`,
   - CLG-004 sets `replied_at`,
   - Slack alert appears,
   - GDR creates a Gmail draft,
   - GDR posts the approval alert,
   - no email is sent without `safe to send`.

## First Five-Contact Batch Status

Hold.

The approval batch remains the right shape, but it should not be sent while n8n is still using the wrong Gmail sender identity.

| Contact lane | Status | Reason |
| --- | --- | --- |
| Jeanine / MentorRI test | Hold | Test copy can be used after sender identity is corrected. |
| Anna Berin | Hold | Warm context matters; do not risk sending from the wrong account. |
| Kyle Peterson | Hold | Good candidate for the next wave, but not before mailbox correction. |
| MentorRI-adjacent operations contact | Hold | Use after smoke passes. |
| Trusted professional-services referral path | Hold | Use after smoke passes. |

## Cleanup Note

The synthetic test row should remain until the corrected-credential smoke completes, because it documents the failed sender-identity proof. After the successful replacement smoke, archive or delete the `is_test_data=true` contact and outreach row for `revenue_reply_smoke_20260624T130723Z`.

## Separate Security Debt

While inspecting `WF-CLG-003`, a direct Supabase REST credential was visible inside an n8n HTTP node. Do not copy that value into docs, chat, or commits.

After the mailbox blocker is fixed, move that workflow path to n8n variables or a proper credential reference and rotate the exposed key.
