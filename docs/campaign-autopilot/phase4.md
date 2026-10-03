# Phase 4: approval binding and receipt qualification

Status: development handoff; delivery remains disabled. Based on `52642457` (PRs #1006 and #1007). The captain closed #1005 as superseded before development. Its alternate `agent_runs` journal and Phase 3 QA assets were not imported.

## Contracts and limits

- `bindStoredCampaignApproval` is the unregistered server-only entry point. It loads the canonical release with `getCampaignRelease`, checks current source fingerprints, and uses the existing `DurableCampaignExecutionStore` RPC contract. It accepts identifiers and expected hash/version, not browser-supplied approval records. No route, cron, Slack handler or default client invokes it.
- `hydrateApprovedCampaign` replays the canonical decision audit, checks actor provenance, exact manifest identity, approval version, evidence/authorization windows and current sources. It stores the exact release and an audit digest in `approvalBindings`. A second canonical read detects intervening decisions; failure leaves the binding invalidated or unconfirmed. This is an approval evidence snapshot, not an atomic dispatch authorization. Every bound release is refused by journal claim/submit/retry, and cannot be approved independently through journal decisions.
- Canonical Portfolio and authenticated Slack decisions continue through the existing decision store. No second live approval system was added. The Slack actor path is tested internally; no Slack delivery, original-card update or receipt canary is claimed.
- `CampaignReceiptVerifier` currently has one deterministic sandbox implementation. It admits only precommitted fixture events and returns frozen, process-owned proofs. Reconciliation rejects plain objects, copied proofs, mismatched callbacks/accounts/content/action keys/receipt types, resource replacement, wrong attempts/retries, stale predecessor receipts and invalid times. Persisted proofs must be reverified by the verifier after restart; a JSON label is not a runtime credential.
- Receipt trust states: synthetic, locally verified, provider accepted, provider confirmed, rejected/no-delivery, uncertain. Every provider label in this phase is sandbox evidence. Acceptance and local checks retain reservations and cannot unlock dependencies. Confirmation matches exact receipt identity and predecessor receipt digests; duplicate callbacks cannot spend twice. Rejection permits bounded retry; uncertainty retains the reservation. No current operation contract permits acceptance to count as completion.
- `registerCampaignProductionWorker` always rejects. All delivery families remain disabled, there is no activation flag or credential import, and no worker connects to the production journal. The legacy injected coordinator now also rejects unclassified or non-synthetic receipts.

## Operator surface

The existing Campaign releases panel adds compact Approval, Persistence and Delivery values, receipt trust and one next action. The live GET endpoint still has no journal connection and truthfully shows `Journal not connected`. Sandbox QA supplies sanitized journal projections on the same existing route; it does not prove a live DB-to-UI connection. Bound evidence is explicitly `review only`. Uncertain receipts make reconciliation the next action.

Exact QA route:
`http://127.0.0.1:3198/admin/campaigns/11111111-1111-4111-8111-000000000002?release=11111111-1111-4111-8111-000000000001`

The guarded launcher uses synthetic credentials, no real env files, and blocks server outbound HTTP. Playwright supplies synthetic admin API responses on the actual rendered route; all other external browser traffic is blocked. The unrelated Vercel analytics script is fulfilled locally and recorded as `analyticsSuppressed`. Final results show zero delivered external requests, zero unexpected blocked requests, and zero page errors at 390/768/1440. These are isolated browser recordings, not a deployed authenticated session.

Controls exercised: Approve release, Hold, Request revision, Emergency stop, disabled reapproval, refresh/error/recovery, readiness disclosure, receipt disclosures, content/scope, metadata, manifest hash, decision history, and the step evidence link. Screenshots and final H.264 MP4 frames were visually inspected at mobile, tablet and desktop widths. The pre-existing adjacent campaign-tab clipping at 390px remains outside the changed release panel.

Evidence: [390px MP4](qa/phase4/campaign-recovery-390.mp4), [768px MP4](qa/phase4/campaign-recovery-768.mp4), [1440px MP4](qa/phase4/campaign-recovery-1440.mp4), plus screenshots and result JSON files under `qa/phase4/`.

## Reproduction and validation

Run from the assigned worktree `/Users/vambahsillah/.codex/worktrees/campaign-approval-receipts/Portfolio`:

```sh
node_modules/.bin/vitest run lib/campaign-release-*.test.ts 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/api/admin/campaigns/[id]/releases/assemble/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx'
node_modules/.bin/eslint lib/campaign-release-activation.ts lib/campaign-release-activation-server.ts lib/campaign-release-receipts.ts lib/campaign-release-authority-receipts.test.ts lib/campaign-release-execution.ts lib/campaign-release-coordinator.ts lib/campaign-release-coordinator.test.ts lib/campaign-release-adapters.ts lib/campaign-release-recovery-view.ts lib/campaign-release-recovery-view.test.ts components/admin/CampaignReleaseReview.tsx scripts/qa/campaign-release-recovery-fixture.ts
node --import tsx scripts/build-chatbot-knowledge.ts
node_modules/.bin/tsc --noEmit --incremental false
node --import tsx scripts/qa/campaign-release-recovery-fixture.ts
node scripts/qa/campaign-release-recovery-server.cjs
# In another terminal:
node scripts/qa/campaign-release-recovery.cjs
# Stop the dev server before this separate build check:
node scripts/qa/campaign-release-recovery-server.cjs --build
git diff --check
```

129 tests across 12 files pass. Changed-file lint and whitespace checks pass. Typecheck reports only baseline duplicate properties at `lib/social-comment-inbox-ui.test.ts:51-52`, confirmed with `git show origin/main:lib/social-comment-inbox-ui.test.ts`. The guarded production build passes (exit 0), including compile, application type validation and static generation, with pre-existing image warnings and expected missing-provider configuration warnings in the synthetic environment. No live workflow/customer-data smoke ran.

## Integration and next gate

No migrations, package changes, environment changes, DB reads/writes, provider requests or paid usage were performed. Optional JSON journal fields preserve schema-v1 compatibility with #1006/#1007; no alternate persistence implementation is introduced. Do not roll back a future populated journal into a worker that ignores approval bindings; keep all workers disconnected and preserve delivery reservations and receipts.

Before live execution: qualify hydration against the staging canonical store with captain authority; implement and qualify an atomic canonical approval/stop fence at the actual provider claim/dispatch boundary; certify provider transport authentication, resource/account identity, callback replay protection, receipt semantics, budget and no-delivery proofs; separately authorize worker/provider activation. The two canonical reads implemented here are deliberately insufficient for live dispatch.

Stop at the draft PR. The captain owns review, integration, both Vercel contexts, deployment and Human QA. This lane has not merged or enabled delivery.
