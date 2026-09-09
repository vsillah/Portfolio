# Warm Gmail review and delivery contract

Internal copy approval, mailbox draft creation, review delivery to Slack, authorization, and Gmail sending are separate operator actions. Every external action requires a named confirmation and a current server-built request packet. Saved metadata and provider identifiers remain behind authenticated admin routes.

## Exact Gmail content

Final-copy identity includes queue/contact identity, normalized recipient address, exact subject and body. Creation and sending validate one recipient and a single-line subject; they reject additional headers or recipients. MIME encoding preserves the full Unicode subject and plaintext body. No Cc, Bcc, attachment, or mailbox-edited content is incorporated.

Sending uses the existing draft ID with a new `message.raw` in the same `drafts.send` request. This follows the [Gmail draft send contract](https://developers.google.com/workspace/gmail/api/guides/drafts#send_drafts), which supports replacing a draft's content while sending it. There is no separate read/update/send interval. ID-only helper calls fail closed and must route to the exact-copy review flow.

## Revising a known unsent mailbox draft

After editing saved copy, internal approval is required again. The workroom offers an explicit `Update Gmail draft` confirmation for a known tracked unsent draft. The endpoint uses `drafts.update` with that draft ID and newly approved MIME; it does not create a replacement draft. A versioned claim locks concurrent updates and retains uncertainty if the provider result or tracking is unconfirmed.

Only a confirmed same-ID update records the new fingerprint/message evidence and clears the provider reconciliation marker. Previous copy, authorization, request and delivery are retained in revision history; active authorization/request/delivery are invalidated. The workroom consumes authoritative post-edit state and returns to fresh review preparation. A revision-scoped Slack card key prevents old-card reuse even if earlier wording is restored. Unknown draft creation, Slack delivery or Gmail send attempts cannot enter this recovery path.

## On-demand Slack review delivery

`ENABLE_WARM_GMAIL_SLACK_REVIEW_DELIVERY` defaults off. The action resolves the existing source-scoped Slack bot/channel configuration independently from scheduled notification enablement. It does not mutate scheduled notification settings. The configured workspace must match the bot's `auth.test` identity and the channel must pass the shared source-channel authorization check.

Preparation is read-only and names the configured workspace/channel. Confirmation must match the current saved pending request, approved copy, mailbox fingerprint, and displayed row version. The server rebuilds message blocks; clients cannot select a destination or supply message content. The card includes source provenance and a deep link to the exact Portfolio review.

A unique `agent_runs` record and conditional running claim fence delivery. A second outreach-row version claim prevents an interleaved edit from dispatching an obsolete request. Only a successful Slack response with the configured channel and a valid timestamp produces a sent receipt. Timeouts, malformed results, or persistence failures retain the claim and require reconciliation. Request rebuilding cannot clear sent or unresolved delivery evidence. No automated resend is offered.

## Operator recovery and validation

The existing workroom shows exact sender, recipient, subject/body and destination confirmations, named action buttons, direct mailbox draft links, refresh, and receipts. Setup blockers leave external actions disabled. Submitted or uncertain outcomes lock duplicate attempts and point to the relevant mailbox or Slack channel for reconciliation.

Synthetic tests exercise route readiness packets through the UI request builder, immutable MIME payloads, stale versions, unauthorized destinations, wrong workspace, concurrent claims, provider uncertainty, receipt-write failure, and request rebuild preservation. The recording script `scripts/record-warm-gmail-actions-qa.mjs` intercepts provider paths and records desktop, tablet, and mobile workflows. Recordings and operational handoff files are local review artifacts, not public deployment evidence.

No activation, real message delivery, scheduling change, migration, credential change, or production verification is implied by these source changes.
