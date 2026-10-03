# Phase 3: durable transaction and receipt qualification

Phase 3 adds a dormant database CAS adapter to the canonical Phase 2 journal. No live worker, API route, Slack callback, provider transport or database is connected. This is implementation and synthetic qualification; deployed distributed durability remains unverified.

## Preflight

Base `f8053cf64efb5768ec900c7933c71360c859771a` (merged #1003). Branch `codex/campaign-durable-execution`; worktree `/Users/vambahsillah/.codex/worktrees/3a94/Portfolio`. Fetched origin, inspected status/log/diff, and all 31 open PR file lists. No exact campaign contract overlap. Dependent on merged Phase 2, now based on that merge. Shared surfaces: campaign `lib`, existing review component, and QA scripts. No schema, layout, package, lockfile or unrelated route changes.

## Transaction boundary

`DurableCampaignExecutionStore` implements the existing `CampaignTransactionStore`. A synchronous pure journal transition reads a detached snapshot, computes its changes, and atomically updates one shared `agent_runs` row only if the persisted metadata version still matches. Definite conflicts retry at most eight times. Thrown/uncertain commits never replay automatically. No provider call is permitted inside a transaction callback.

A fixed journal identity plus the existing unique primary key/idempotency key serialize initial creation. Every update filters identity, kind and prior version. One row deliberately contains releases, delivery keys, reservations, spends and receipts: cross-release duplicate-delivery checks and same-release budget checks cannot become separate commits. It is a correctness-first bounded-workload implementation, not a high-throughput partitioned scheduler. Growth/compaction and load qualification are Phase 4 gates. Never delete or reset this row to clear contention; that destroys delivery history.

The existing journal remains authoritative for exact-hash approval, 60-second owner/version leases, persisted submission before dispatch, predecessor receipt matching, bounded retry, emergency stop, and uncertain reservation retention. All distributed workers must use this single journal and trusted clock inputs. The adapter is injectable and has no default Supabase client, environment lookup or activation flag.

The existing review/API approval record is NOT automatically copied or synchronized into this journal. Phase 4 must establish one atomic approval/stop authority before connecting workers. Do not dual-write approval decisions or treat caller-supplied review bindings as certified authority. One-response Slack intent remains an exact-packet decision; this work activates no Slack behavior.

## Receipt contract

| Level | Meaning | Phase 3 eligibility |
| --- | --- | --- |
| synthetic | No-delivery adapter generated a simulated matching receipt | May settle only the synthetic journal |
| locally_verified | Local consistency checks passed | Does not prove delivery |
| provider_accepted | Provider acknowledged the request | Does not prove completion |
| provider_confirmed | Candidate provider completion evidence | Requires a certified verifier; none registered |
| rejected | Evidence or request rejected | Cannot satisfy a predecessor |
| uncertain | Missing or ambiguous outcome | Retain reservation; no resend |

Journal settlement and predecessor checks require synthetic trust AND a synthetic receipt identity, plus exact provider/account/content/delivery/type matching. Missing trust fails closed. Every reconciliation now requires explicit `mode: synthetic`, including simulated no-delivery evidence. Old raw callback shapes fail closed. This discriminator labels simulation; it is not an authentication or cryptographic verification mechanism. No production receipt verification endpoint exists. Phase 2 persisted receipts without trust must be reconciled again; they cannot silently qualify as predecessors.

The existing review panel shows approval binding, persistence status, synthetic delivery status and a derived next action. Ownership, fences and raw callbacks stay out of browser projections. Browser actions remain review/approval/stop only; execution and recovery are disabled/read-only.

## Compatibility and rollback

No migration, environment change, permissions change, database write or provider activation. Existing `agent_runs` schema supports the dormant adapter. Reverting this code restores Phase 2 UI; retain any future persisted journal and its delivery barriers. Before registration, qualify current deployed schema, admin-only metadata access, concurrent database CAS semantics, clock authority, lost-response behavior and approval/stop integration. Do not infer those from mocked SDK tests.

## Validation and evidence

98 focused tests across 11 files pass; changed-file ESLint and whitespace checks pass. Tests cover independent worker contention, callback duplicates, conflicting callbacks, crash/restart, stale owners, bounded retries, predecessor mismatch, unknown receipt trust, budget preservation and uncertain commit responses. SDK transport tests inspect the actual generated conditional PATCH without network access. Deterministic CAS tests model database atomic compare-and-swap; they are not a live database test.

Commands:

```sh
git fetch origin --prune
git status --short --branch
git log --oneline --decorate --max-count=5
gh pr list --state open --limit 100 --json number,title,headRefName,files
git diff --name-only origin/main...HEAD
node_modules/.bin/vitest run lib/campaign-release-*.test.ts 'app/api/admin/campaigns/[id]/releases/assemble/route.test.ts' 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx'
node_modules/.bin/eslint lib/campaign-release-{durable-store,receipts,execution,adapters,recovery-view,coordinator}.ts lib/campaign-release-{durable-store,recovery-view,execution}.test.ts components/admin/CampaignReleaseReview.tsx scripts/qa/campaign-release-recovery-fixture.ts
node --import tsx scripts/build-chatbot-knowledge.ts
node_modules/.bin/tsc --noEmit --incremental false
node --import tsx scripts/qa/campaign-release-recovery-fixture.ts
node scripts/qa/campaign-release-recovery-server.cjs
node scripts/qa/campaign-release-recovery.cjs
git diff --check
```

The synthetic route is `http://127.0.0.1:3199/admin/campaigns/11111111-1111-4111-8111-000000000002?release=11111111-1111-4111-8111-000000000001`. The test browser supplies synthetic auth/API projections from the actual journal. A separate ordinary browser context does not inherit them. The local disk CAS transport exercises the same durable store; no deployed persistence is claimed by its screenshots.

Widths: 390, 768, 1440. Approval, Hold, Request revision, stop, refresh/error recovery, receipt disclosure, evidence navigation, provider-disabled state, partial completion, submitted uncertainty and retry eligibility are exercised. Unrelated layout analytics is suppressed in the fixture browser before insertion; the initial discovery run blocked one analytics attempt before egress. Final captures require zero external attempts. Server environment is credential-free with an outbound guard. Artifacts are under `qa/phase3`. Existing adjacent mobile tab-strip clipping remains outside this change.

Typecheck retains baseline TS1117 errors at `lib/social-comment-inbox-ui.test.ts:51-52`; no production build is claimed. No live customer-data smoke, provider request, database write, migration, external delivery, purchase, merge or deployment was performed. Expenses: $0.

## Phase 4 gate

Captain review, then database concurrency/permission/clock qualification and a single durable approval/stop authority. Certify provider receipts and provider-specific idempotency/reconciliation separately before considering activation. Human QA and any activation authority remain open. Keep this lane visible.
