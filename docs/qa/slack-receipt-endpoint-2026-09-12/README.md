# Slack receipt endpoint validation — 2026-09-12

## Finding and scope

Baseline: `bf70aab7f82a4060193fd355c16b6836b3ffc73e` (merged PR #973).
The endpoint already imports `acceptSlackAction` and `processSlackReceipt` and schedules the worker with `waitUntil`. This wiring landed in `e2dfa054` (PR #957). A report of production calling the handler inline therefore requires captain verification of the deployed commit and callback destination; this packet does not prove or repair a deployment mismatch.

This change rejects parsed JSON null, arrays and primitives with HTTP 400 before receipt acceptance. Existing unsupported interaction behavior is retained: authorized `view_submission` and unsupported types return the existing ephemeral “expected one block action” rejection, with no receipt or mutation. No modal support is introduced.

## Synthetic evidence

`app/api/slack/agent/actions/route.signed.test.ts` exercises the real route, HMAC verifier, action decoder, authorization, `acceptSlackAction`, and production `receiptStore` adapter against an in-memory Supabase transport. Background processing is deliberately replaced with a never-resolving promise to prove the ACK does not await execution. Existing receipt worker suites separately exercise concurrency, recovery, and ambiguous mutation handling.

Observed assertions:

- Valid signed callback: HTTP 200 within 2,500 ms; one `agent_runs` row with kind `slack_action_receipt`, queued state and no canonical outcome.
- ACK says saved and queued, completion unconfirmed, and links to the saved receipt ID.
- Signed Slack retry exercises the unique-conflict lookup and returns the same receipt/ACK; row count remains one.
- Worker receives the saved idempotency key and is registered with `waitUntil`.
- Invalid, stale, and invalid retry signatures: HTTP 401 before any database access.
- Disabled or mismatched receipt environment, ephemeral card, unsupported/modal payload, unapproved channel, and malformed action: no row, trace, or worker call.
- Unconfirmed database write: HTTP 503, no saved claim or inline fallback.
- Dispatch/worker failure: saved ACK preserved for existing cron recovery.
- `response_url` is neither persisted nor fetched. The fetch trap is asserted unused after every signed test.

No UI changed. An MP4 would not demonstrate server receipt persistence; these executable synthetic checks and terminal results are the review artifact.

## Commands and results

```text
node_modules/.bin/vitest run app/api/slack/agent/actions/route.test.ts app/api/slack/agent/actions/route.signed.test.ts lib/slack-action-receipts.test.ts lib/slack-action-receipts.contract.test.ts app/api/cron/slack-action-receipts/route.test.ts lib/slack-receipt-status.test.ts lib/slack-warm-receipt.integration.test.ts lib/agent-slack-actions.test.ts
Test Files  8 passed (8)
Tests       184 passed (184)
Duration    502ms

node_modules/.bin/eslint app/api/slack/agent/actions/route.ts app/api/slack/agent/actions/route.test.ts app/api/slack/agent/actions/route.signed.test.ts
PASS

git diff --check
PASS
```

## Boundaries and captain follow-up

No live Slack callback, Slack message, provider action, Gmail draft/send, social publication, SMS, production mutation, credential/environment change, merge, or deployment occurred. Test environment variables were synthetic process-local stubs restored after each test. Database durability here is demonstrated only through the mocked store path, not a live database.

Cron recovery and receipt state transitions are unchanged. Existing worker tests verify concurrent execution ownership, feedback-only retries, and reconciliation rather than replay after an ambiguous canonical mutation; this is not proof of exactly-once external delivery.

The captain must verify the production callback destination and deployed commit, receipt configuration, and both `Vercel – portfolio` and `Vercel – portfolio-staging` contexts. Neither Vercel context was checked by this development lane. No production build or live/customer-data smoke was run. No migration or environment change is required by this PR.

## Typecheck limitation

`node_modules/.bin/tsc --noEmit --incremental false` exited 2 with four diagnostics outside changed files:

```text
lib/chatbot-knowledge.ts(69,30): TS2307 missing ./chatbot-knowledge-content.generated
lib/social-comment-inbox-ui.test.ts(51,5): TS1117 duplicate object property
lib/social-comment-inbox-ui.test.ts(52,5): TS1117 duplicate object property
lib/video-ideas-context.ts(8,40): TS2307 missing @/lib/chatbot-knowledge-content.generated
```

No changed endpoint/test file had a typecheck diagnostic. These unrelated files were left untouched.
