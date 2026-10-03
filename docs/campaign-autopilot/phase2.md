# Phase 2: packet assembly and synthetic recovery

Status: development handoff. Production execution remains disabled. This phase qualifies local durable coordination and review projections; it does not close Campaign Autopilot Closure.

## Delivered

- Read-only `POST /api/admin/campaigns/[id]/releases/assemble` assembles exact copy from canonical social, outreach, and video rows. The request supplies bounded review bindings and source IDs, not replacement copy. It returns an unsaved packet for the existing preparation and approval endpoints.
- Campaign/calendar/contact fingerprints are included in optional `planningSources` inside the immutable manifest hash. Existing manifests without that field retain their hashes. Preparation and approval recheck those rows along with action sources.
- Assembly requires explicit campaign linkage, approved social/warm copy, exact canonical recipient and media references, final YouTube media, and an unsubmitted render plan. Missing linkage fails closed. Existing HeyGen jobs with provider IDs require reconciliation, not another render. Warm attachments and unbound render assets are unsupported.
- `CampaignExecutionJournal` implements atomic release decisions, globally unique delivery claims, owner/version fences, 60-second leases, per-step receipts, callback deduplication, partial outcomes, three-attempt limits, terminal stop, and explicit recovery.
- Budget reservations and spend entries commit in the same transaction as ownership and receipts. Unknown outcomes retain the full reservation. Only verified zero-cost/no-delivery proof permits retry. Confirmation matches content hash, account, delivery key, provider and receipt type. Late receipts may settle after stop without reopening authority.
- `LocalCampaignExecutionStore` persists synthetic state with an exclusive lock, fsync and atomic rename. Tests reopen the journal after restart. It is not imported by a web route or production worker.
- Disabled adapter interfaces cover social, warm outreach, video/YouTube, Gmail and Slack. They have no transport, credentials, activation flag or environment override. SMS/Telnyx remains excluded.
- The existing Campaign Release Review now has collapsed readiness/recovery details, per-step dependency guidance, receipts, reservation/spend information and channel-review links. It explicitly states that live recovery is read-only. No extra dashboard, queue or executable retry button was added.

## Integration boundary

The production releases GET endpoint does not load execution attempts yet. The UI accepts the future `executionAttempts` projection, and synthetic QA supplies projections exported from the tested journal. Production shows preparation/provider-disabled guidance. The original coordinator remains unchanged and unregistered; the journal is a separate, synthetic-qualified transaction contract for the next integration phase.

A distributed store, trusted receipt/no-delivery verifier, source/consent/suppression rechecks at the provider claim boundary, and independently certified provider adapters are still required before live execution. Evidence IDs and asset digests supplied during assembly are review bindings, not independent verification that an asset or consent record is valid. The assembler cannot certify provider authority.

The local store serializes cooperating processes on one local filesystem. Lock contention fails closed. If a process crashes while holding `<journal>.lock`, first verify the recorded worker PID has exited and that no worker is using that journal. Inspect the saved snapshot, preserve a copy of the journal and lock, then remove only that stale lock and reopen the journal. Recover an expired submitted attempt into reconciliation; never delete its delivery claim or reservation to retry. This is an operator procedure, not automatic stale-lock eviction. Network filesystems and distributed database transactions are unqualified.

No migration, production data mutation, provider call, publishing, Gmail send, Slack dispatch, SMS, YouTube upload, scheduling, activation, credential change or charge was performed.

## Preflight

- Base: `38df8c1a28166e1f042983bec1eb7a8220533001` (#1001).
- Branch: `codex/campaign-autopilot-recovery`.
- Worktree: `/Users/vambahsillah/.codex/worktrees/a655/Portfolio`.
- The initial checkout was clean and detached at `b8df8914`; the named branch was created directly from fetched `origin/main`.
- All 30 open PR file lists were inspected. No intended-file overlap. #976 owns existing Slack receipt tests; #999 owns testing/remediation route tests. Neither was modified. No migration, shared layout, package or lockfile changes.
- Classification: Independent on merged #1001. Captain retains merge/deployment authority.

## Validation

199 focused tests passed across 12 files, including existing Slack callback/receipt and campaign-page regression tests. Changed-file ESLint and `git diff --check` passed.

```sh
node_modules/.bin/vitest run lib/campaign-release-*.test.ts 'app/api/admin/campaigns/[id]/releases/assemble/route.test.ts' 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx' lib/agent-slack-actions.test.ts lib/agent-slack-blocks.test.ts lib/slack-action-receipts.test.ts
node_modules/.bin/eslint lib/campaign-release-{packet,execution,local-store,adapters,recovery-view,manifest,store}.ts lib/campaign-release-{packet,execution,planning-evidence}.test.ts components/admin/CampaignReleaseReview.tsx 'app/api/admin/campaigns/[id]/releases/assemble/route.ts' 'app/api/admin/campaigns/[id]/releases/assemble/route.test.ts' scripts/qa/campaign-release-recovery-fixture.ts
git diff --check
node --import tsx scripts/build-chatbot-knowledge.ts
node_modules/.bin/tsc --noEmit --incremental false
```

Full TypeScript validation remains blocked only by existing duplicate properties in `lib/social-comment-inbox-ui.test.ts:51-52`. The generated knowledge file was rebuilt locally to remove unrelated missing-file diagnostics. No phase-2 type errors were reported. A production build was not run while baseline typecheck is failing.

## Reproduce visual evidence

Use this worktree, its dependency installation, and no real `.env*` files. The isolated launcher strips credentials and blocks server egress. Browser requests are restricted to the synthetic local fixture routes.

```sh
node --import tsx scripts/qa/campaign-release-recovery-fixture.ts
node scripts/qa/campaign-release-recovery-server.cjs
# Separate terminal after the server is ready:
node scripts/qa/campaign-release-recovery.cjs
```

Exact route: `http://127.0.0.1:3198/admin/campaigns/11111111-1111-4111-8111-000000000002?release=11111111-1111-4111-8111-000000000001`. The Playwright context installs synthetic auth/API responses; opening the URL in a different browser context does not reproduce that fixture session.

Widths: 390, 768, 1440 pixels. Tested approval, disabled-provider state, dependency/partial completion, submitted outcome, restart recovery, uncertain outcome, verified no-delivery/retry eligibility, confirmed receipts, receipt disclosures, terminal stop, unavailable-data refresh recovery and step-evidence navigation. No horizontal page or panel overflow and no page errors. Screenshots and decoded MP4 frames were visually inspected at all three widths. The adjacent mobile campaign tab strip retains its pre-existing clipping; this lane does not change that container.

Artifacts are in `qa/phase2/`: nine selected screenshots, result JSON for each width, and `campaign-recovery-390.mp4`, `campaign-recovery-768.mp4`, `campaign-recovery-1440.mp4`. Videos are H.264 MP4, approximately 13–15 seconds, with no private/customer data. The fixture spends 75 synthetic cents in a local ledger; actual expenses are $0.

No live workflow/customer-data smoke, production persistence, provider receipt verification, signed Slack callback, real charge, or deployment smoke was run. Vercel checks are reported on the draft PR. Both `Vercel – portfolio` and `Vercel – portfolio-staging` must pass captain review before deployment can be declared verified.

## Next gate

Captain review of the draft PR and synthetic evidence; resolve baseline typecheck failures before treating the branch as build-validated. Then qualify a distributed transactional store and trusted reconciliation boundary in a separately scoped lane. Provider activation and production migrations retain their separate authorization gates. Keep this development lane visible through captain review and human QA.
