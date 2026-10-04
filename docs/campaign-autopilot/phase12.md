# Phase 12: signed Slack campaign review and outcomes

Development handoff, 2026-10-04. Base: `a7394149515e497e3ac2f283342d2d777da236fd`. Branch: `codex/campaign-signed-slack-closure`. Worktree: `/Users/vambahsillah/.codex/worktrees/a5e3/Portfolio`.

This phase closes the local, synthetic command/decision/feedback path. It does not complete Campaign Autopilot Closure or establish live Slack or provider readiness.

## Behavior

The existing campaign Content Calendar release panel has a compact **Slack review** disclosure. An admin can prepare a durable dispatch intent without sending. **Send review to Slack** is disabled until the environment is separately qualified and configured. There is no duplicate dashboard or campaign approval model.

`campaign_slack_dispatch` records reuse `agent_runs` and its existing unique `idempotency_key`. The source environment, origin, release UUID, manifest hash and release version determine a single dispatch intent. Before posting through the existing Slack bot transport, a compare-and-swap changes `prepared` to `sending`. Sent, uncertain, rejected and abandoned sending intents cannot automatically resend. A returned channel/timestamp must match before the intent becomes `sent`.

Signed HTTP callbacks use the existing signature verifier, workspace/operator/channel allowlists and `slack_action_receipt` worker. The receipt envelope now retains `manifestHash`, `releaseVersion` and `dispatchIntentId`. A decision must match the recorded dispatch's UUID/hash/version, workspace, channel, exact original message timestamp and source environment/origin. Source fingerprints are checked again. Missing identities, legacy cards, changed sources, expired releases, stale versions and conflicting decisions fail closed.

The campaign decision, audit entry and signed command context are saved together using the existing release row's hash/version CAS. Concurrent different decisions cannot both win. Exact callback replays reuse the receipt and explicitly acknowledge a duplicate without starting a new decision. The first durable receipt and campaign audit remain the canonical records; duplicate ACKs do not create separate execution rows.

Approval records release intent only. No campaign adapter, content generation, Gmail, SMS, social publishing, external scheduling, n8n activation, billing or credential mutation is invoked. Per-recipient authority, final submission, privacy, budget, consent and suppression requirements remain in force.

The receipt worker updates only the saved Slack card through the existing guarded history/read/update path. Success removes all four obsolete decision controls for that exact campaign gate while preserving source links and unrelated controls. Slack does not provide conditional `chat.update`; independent external writers still require reconciliation. Missing credentials/scopes/card identity produce a durable blocked state instead of false success.

Portfolio reads the dispatch and callback records, then reads the current release state. Refreshing Slack status also refreshes the parent release decision; older responses cannot overwrite a newer release version. The existing Agent Ops run route exposes both evidence records.

## Recovery

| Observed state | Meaning and next step |
| --- | --- |
| No dispatch / prepared | No confirmed message was sent. Review the exact release and qualify Slack configuration before dispatch. |
| Sending / dispatch unconfirmed | The card may exist. Inspect the dispatch record with the Captain and reconcile the original card. This intent cannot resend. |
| Dispatch rejected | No successful card receipt was saved. Inspect configuration and reconcile before any new release/card; automatic retry is deliberately unavailable. |
| Callback accepted | Signed callback is durably queued; decision completion is pending. Refresh the receipt. |
| Duplicate callback | Slack receives the existing receipt plus an explicit duplicate ACK. No new decision is queued. |
| Decision blocked | Source/card/version/authorization no longer matches. Open the current release and prepare a fresh reviewed packet when appropriate. |
| Callback outcome unconfirmed | Inspect the campaign audit and durable receipt. Never repeat campaign execution to resolve uncertainty. |
| Card update failed | Decision remains durable. Transient feedback recovery retries only the original-card update. |
| Card update blocked | Verify the source app token, history scopes, conversation membership and ability to update its own message. Have the Captain reconcile the saved receipt; no automatic campaign/card resend or credential mutation is provided. |

A lost decision write returns an unconfirmed result. A lost receipt-outcome write retains `executing`; after lease expiry the existing worker requires reconciliation and does not rerun the decision. There is intentionally no generic "retry campaign" action.

## Activation gates retained

No environment files, secrets, app scopes, tokens, signing settings or hosted rows were changed. No migration is required or applied.

Before any authorized live canary, the Captain must:

1. Review this PR and qualify the existing `agent_runs` uniqueness/CAS and receipt recovery contracts in the intended hosted environment. Unit/integration tests here use in-memory persistence; they are not hosted concurrency proof.
2. Independently verify the Portfolio Agent Ops app, intended workspace/operator/channel allowlists, source-specific origin/token/channel, signed HTTP callback route and receipt worker environment.
3. Obtain the required live Slack authority before changing configuration or posting a canary. `CAMPAIGN_SLACK_DISPATCH_ENABLED=true` is an additional campaign gate; existing notification and receipt flags, `SLACK_SIGNING_SECRET`, allowlists and source-specific delivery configuration must also pass. Local source mode always refuses dispatch.
4. Route one fresh synthetic release, make one decision, verify the campaign audit and receipt, confirm the exact original card update, and verify duplicate/recovery behavior. Preserve resulting evidence before claiming live qualification.
5. Keep provider adapters, verifier identities/credential references, account/resource authorization, final submission, per-recipient approval, consent/suppression, enforceable budgets and private-data gates separate. Phase 11 provisioning is still default-off. SMS remains excluded from the release schema.

Source checks and release CAS are separate reads/writes. This path records review intent, not atomic authority over changing provider/source state; dispatch-time provider checks remain mandatory in the execution architecture.

## Validation

Reproduction from this worktree:

```sh
npm run build:knowledge
node_modules/.bin/vitest run lib/campaign*test.ts lib/slack-action-receipts*.test.ts lib/slack-warm-receipt.integration.test.ts lib/agent-slack-{actions,blocks,notifications}.test.ts 'app/api/slack/agent/actions/route.signed.test.ts' 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/api/admin/campaigns/[id]/releases/slack/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx'
node_modules/.bin/eslint lib/campaign-slack-*.ts lib/agent-slack-delivery.ts lib/agent-slack-actions.ts lib/agent-slack-blocks.ts lib/agent-slack-notifications.ts lib/campaign-release-slack.ts lib/slack-action-receipts.ts components/admin/CampaignSlackReview.tsx components/admin/CampaignReleaseReview.tsx 'app/api/admin/campaigns/[id]/releases/slack/'
node_modules/.bin/tsc --noEmit --incremental false
git diff --check
CAMPAIGN_QA_PORT=3199 node scripts/qa/campaign-release-recovery-server.cjs
node scripts/qa/campaign-slack-closure.cjs
```

- Regression: 518 passed, 300 skipped across 33 files. Skipped tests require optional disposable PostgreSQL URLs; no hosted database test was run.
- New coverage: signature freshness/validity, actor/workspace/channel/source binding, release UUID/hash/version/message binding, dispatch default-off and prerequisites, duplicate and concurrent decisions, stale source/expiry, lost dispatch/decision/receipt writes, no provider invocation, original-card update, blocked/failed feedback and admin API authorization.
- Lint and whitespace checks pass. Typecheck reports only existing duplicate-property errors in `lib/social-comment-inbox-ui.test.ts:51-52`, confirmed unchanged from the base commit. Production build not run because this baseline type gate fails; the actual Next development routes compiled for QA.
- Actual route: `/admin/campaigns/11111111-1111-4111-8111-111111111111?release=22222222-2222-4222-8222-222222222222`. Synthetic API interception, local-only server environment and blocked browser egress. Tested 390, 768 and 1440 px with no page/section horizontal overflow and no page errors.
- Every new action exercised: prepare, disabled send, synthetic enabled send, status refresh, disclosure and both dispatch/callback evidence links through the real Agent Ops run route. Also rechecked existing release approve/stop and synchronized parent decision state. States recorded: no dispatch, default-off, sent, accepted, decision recorded, duplicate decision projection, card blocked, callback unconfirmed, dispatch unconfirmed, unavailable/recovery and stale decision.
- Browser skill check: local sign-in page loads with meaningful controls and no Next error overlay. The in-app Browser opened the exact campaign route; automated interaction used an isolated synthetic browser context because no real account/database session is used in this lane.
- Final MP4 frames inspected at desktop and mobile widths. Videos and representative screenshots are synthetic UI evidence, not evidence of a live Slack send, real signed click or provider execution. Normal duplicate callbacks return the unchanged canonical receipt; the duplicate-decision UI frame separately exercises the supported `already_recorded` projection.
- Slack/provider external requests during execution and QA: **0**. Hosted database mutations: **0**. Expenses: **$0**. Authorized GitHub repository operations and public documentation reads are excluded from the application-egress count.

[Mobile MP4](qa/phase12/campaign-slack-390.mp4) · [Tablet MP4](qa/phase12/campaign-slack-768.mp4) · [Desktop MP4](qa/phase12/campaign-slack-1440.mp4). Machine-readable viewport results and validation logs are in [qa/phase12](qa/phase12/).

## Integration handoff

Preflight fetched origin, inspected status/log/base diff and open-PR file inventories. Classified **Dependent** on campaign phases already merged through `a7394149`; based directly on that commit. PR #976 owns Slack canary/status tests and #1016 owns campaign-store tests. Neither owned test file was modified. Shared action/receipt/block contracts receive additive campaign fields; existing Slack regression tests pass.

No merge or deployment was performed by this lane. Both `Vercel – portfolio` and `Vercel – portfolio-staging` remain Captain deployment gates; initial draft PR status is reported in the chat. No live workflow/customer-data smoke was run. Keep the development chat visible through Captain review and human QA.

Roadmap: Phase 12 local review loop complete; hosted signed Slack qualification is next. Provider adapters, current credential/resource authority and bounded supervised provider campaigns remain open. Campaign Autopilot Closure remains unfinished.
