# Slack receipt status — development handoff

A saved decision and a successful Slack card update are separate outcomes. The run detail page now shows both, plus an exact Portfolio review link and collapsed receipt/error details. Slack acknowledgement text links to the persisted receipt trace and identifies card-delivery status. No execution or delivery flag is enabled by this change.

## Pre-flight

- Base: `1f8e9480eca390e6f6ef8e5ec3b62b7b0c6d3e42`.
- Branch: `codex/slack-receipt-live-status`.
- Worktree: `/Users/vambahsillah/.codex/worktrees/a9f8/Portfolio`.
- Classification: **Dependent**, based on merged #957/#961. No exact file overlap with open PRs #972, #969, #966, #964, #962, #960, #959, #958, #956, #954 at pre-flight.
- Shared surfaces: Slack receipt library/tests, run-detail page, one new admin component and QA scripts. No schema, migration, environment or package changes.
- The task initially started at `b8df8914`, an older local main with a separate instruction commit. Preserved that branch as `codex/slack-receipt-live-status-start-20260912`; initialized the requested branch from current origin/main. No unrelated changes were discarded.
- Ran `git fetch origin --prune`, `git status --short --branch`, `git log --oneline --decorate --max-count=5`, `git diff --name-only origin/main...HEAD`, open-PR inventory and each PR's file list.

## Audit of current main

| Path | Persisted decision / outcome | External behavior |
| --- | --- | --- |
| `app/api/slack/agent/actions/route.ts` | Verifies signature; authorizes and saves receipt before acknowledgement; `waitUntil` dispatches worker | No response_url posting in this route |
| `lib/slack-action-receipts.ts` | `agent_runs.kind=slack_action_receipt`; CAS fences and leases; canonical outcome saved before feedback; uncertain execution is not replayed | Original card update already implemented via bounded `conversations.history`/`conversations.replies` lookup and `chat.update`; verifies exact channel/timestamp; preserves unrelated controls |
| Warm Gmail Slack adapter | `outreach_queue.generation_inputs.warm_gmail_send_authorization` and history | `gmail_send_called=false`, `external_send_performed=false`, provider/external execution disabled |
| Calendar draft handoff | Calendar authorization, internal draft/revision work item | Draft-only/internal routing; provider generation, scheduling, publishing and external posting disabled |
| Comment reply decision | `social_content_comments.metadata.slack_reply_decision`, reply approval state, hold/history | `external_submission_performed=false`; approval's hold is not a send receipt |

The prior missing-receipt-route finding was stale-checkout evidence. This lane did not reproduce the captain's production SQL counts or inspect production flags. Zero receipt rows alone cannot establish which activation/configuration gate is missing. Current receipt processing is default-off and requires matching hosted source/environment configuration. `response_url` is deliberately excluded from persisted envelopes. Original-card delivery support is proven by unit tests, not by live Slack activity.

Existing receipt tests cover duplicate workers, authorization before persistence, transient delivery retries without canonical replay, permanent access/card failures, root and thread-card identity, sibling-button removal, stale owners and ambiguous outcomes. New warm integration tests run the real decoder, authorization, action adapter and receipt worker against in-memory persistence and a mocked Slack transport, proving one mutation/history entry for approve, reject and revise across duplicate callbacks. Comment rejection and real comment envelope reconstruction coverage were also added.

## Validation

```sh
./node_modules/.bin/vitest run lib/slack-action-receipts.test.ts lib/slack-action-receipts.contract.test.ts lib/slack-warm-receipt.integration.test.ts lib/slack-receipt-status.test.ts components/admin/SlackReceiptStatus.test.tsx 'app/admin/agents/runs/[runId]/page.test.tsx' lib/warm-outreach-slack-send-approval.test.ts lib/agent-slack-actions.test.ts lib/social-content-calendar-handoff.test.ts app/api/slack/agent/actions/route.test.ts app/api/cron/slack-action-receipts/route.test.ts
node --import tsx scripts/build-chatbot-knowledge.ts
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/next lint --file lib/slack-action-receipts.ts --file lib/slack-receipt-status.ts --file components/admin/SlackReceiptStatus.tsx --file 'app/admin/agents/runs/[runId]/page.tsx' --file lib/slack-warm-receipt.integration.test.ts --file lib/slack-receipt-status.test.ts --file components/admin/SlackReceiptStatus.test.tsx --file lib/agent-slack-actions.test.ts --file lib/slack-action-receipts.contract.test.ts --file lib/slack-action-receipts.test.ts
node --check scripts/qa/slack-receipt-status-server.cjs
node --check scripts/qa/slack-receipt-status-ui.cjs
git diff --check
```

- Focused suites: 195 tests passed in 11 files.
- Lint: passing for all changed TypeScript files.
- Knowledge generation: passed; ignored generated bundle excluded from the commit.
- Repository typecheck: blocked by pre-existing TS1117 duplicate `submittedReplyLocked` and `submittedReplyLockReason` fields in `lib/social-comment-inbox-ui.test.ts:51-52`, verified on origin/main. No errors reported in changed files. Full production build not run while this baseline typecheck is failing; Next compiled the actual QA routes successfully.
- No live workflow/customer-data smoke was run. Neither Vercel context was used for this local development QA; captain must verify `Vercel – portfolio` and `Vercel – portfolio-staging` before integration.

## Reproduce rendered QA

Use a clean worktree with dependencies installed and no real `.env` files:

```sh
node scripts/qa/slack-receipt-status-server.cjs
# In another terminal:
node scripts/qa/slack-receipt-status-ui.cjs
```

The server uses synthetic localhost credentials, a clean runtime environment, disabled n8n outbound behavior, and an HTTP/fetch egress guard. Fonts use a local Arial fixture to avoid network font downloads. This does not change hosted environment configuration. The recorder blocks external requests, mocks auth and API responses, and records the real `/admin/agents/runs/11111111-1111-4111-8111-111111111111` route. It does not submit Slack actions or write to a database.

At 1440, 768 and 390px, exercised queued, saved/retry-pending, delivery-blocked, delivered and reconciliation states; Refresh; Receipt details; and Review decision navigation to `/admin/outreach?tab=leads&filter=warm&id=42&contactId=42#warm-gmail-operating-loop`. Verified no receipt/page overflow or page errors. The destination's data workflow was not exercised. The existing narrow breadcrumb/header layout is outside this change; the new receipt panel is readable with the real sidebar/content lane.

- [Desktop MP4](slack-receipt-1440.mp4)
- [Tablet MP4](slack-receipt-768.mp4)
- [Mobile MP4](slack-receipt-390.mp4)
- Companion `receipt-*.json` files record fixture scope, viewport and blocked requests.

These MP4s demonstrate local rendered behavior. They are not hosted Human QA approval, original-card visual proof, or live Slack/provider receipts.

## Remaining captain and live-canary gates

1. Resolve or independently disposition the baseline typecheck failure; review this draft PR and both Vercel contexts.
2. For Human QA, open the exact authorized hosted receipt route in the in-app Browser and record a same-route walkthrough. Keep this development lane visible through that gate.
3. A live canary requires separate approval naming the environment/deployment commit, synthetic receipt target, Slack workspace/channel/message, one specific decision, and permission for its durable receipt/decision writes and original-card `chat.update`. Any required activation/configuration changes must be separately named and approved. Keep Gmail/SMS/provider send, publishing, scheduling and n8n changes prohibited.
4. Confirm persisted canonical decision and receipt id, original-card timestamp/channel acknowledgement and visible updated card; verify no provider execution evidence. A local mocked test, accepted callback or user-reported app installation does not satisfy this gate.

No merge, deployment, n8n mutation, production SQL write, credential change, Slack send, Gmail send, SMS, publishing, scheduling or paid usage was performed in this development lane.
