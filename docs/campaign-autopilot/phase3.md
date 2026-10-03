# Phase 3: durable execution store qualification

Status: draft implementation, database qualification pending. This does not close Campaign Autopilot or enable live execution.

## Scope and preflight

Base: `f8053cf64efb5768ec900c7933c71360c859771a` (merged Phase 2, #1003). Branch: `codex/campaign-transaction-safety`. Worktree: `/Users/vambahsillah/.codex/worktrees/campaign-transaction-safety/Portfolio`.

Fetched origin, inspected status/history/diff and all open PR file lists. No open PR owned the changed campaign-release files. Classification: dependent on Phase 2, already merged into this base. No primary checkout edits. The visible task listing did not expose either queued duplicate identifier; no unrelated task was archived.

## Implementation

`DurableCampaignExecutionStore` implements the existing `CampaignTransactionStore` contract through two injected RPCs. It does not import a provider, credential, activation flag, or production client. The existing journal retains exact-hash approval, globally unique delivery identities, owner/version fences, 60-second leases, predecessor receipt requirements, three-attempt limits, stop semantics and atomic reservation/spend accounting.

The proposed PostgreSQL store uses one versioned row for the entire journal. Each compare-and-swap update commits the release decision, attempt, reservation and receipt together. Workers losing a version race reread and revalidate the transition, at most five times. Failed/unknown acknowledgments and thrown transport exceptions never automatically replay. After a lost submission acknowledgment, a restarted worker reads the saved attempt, recovers the expired fence into reconciliation and retains the reservation. Old workers cannot submit through the new fence.

The singleton preserves delivery identity across release IDs. It intentionally limits throughput and fails closed at an 8 MiB snapshot size; it is a bounded qualification design, not a high-throughput deployment claim. Future partitioning must preserve cross-release delivery uniqueness. RPC callers are trusted service-side journal code: the database provides atomic compare-and-swap, while the TypeScript journal enforces state-machine rules. A privileged caller bypassing that code is outside this contract.

Reconciliation now requires explicit `trust: synthetic`; confirmed receipts also need that classification and a synthetic ID. Unclassified historical receipts project as reconciliation-required. This is test provenance, not provider verification or a cryptographic attestation. Synthetic evidence must never authorize a future live adapter. The existing review component keeps the same compact disclosure and explains reservation retention.

## Migration and compatibility

Authored, **not applied**: `supabase/migrations/20261003104423_campaign_execution_journal.sql`, generated with `supabase migration new campaign_execution_journal`.

It adds a journal table plus snapshot/commit functions. RLS is enabled; PUBLIC, anon and authenticated have no table or function privileges. Functions use SECURITY INVOKER and an empty search path. Service role receives only the required table/select-update and function execution privileges. This does not rewrite existing agent_runs records or local journal files.

No production route or worker registers the new store. Existing approval records remain in agent_runs; there is no automatic transfer of approval into this journal. A future activation must choose one authoritative release store and validate migration/hydration of exact manifests and approval audits. Source, consent and suppression verification at dispatch, database-authoritative lease timing, production receipt verification, permission review and provider certification remain separate gates.

Rollback procedure: first disconnect every consumer; export and preserve the singleton journal and its reservations; then, under a separately approved database change, remove the two functions and table. Never erase uncertain claims to regain delivery eligibility. A migration application/rollback was not attempted on local, staging or production databases. SQL syntax, real PostgreSQL contention, RLS/grants and restart durability remain unverified until an authorized database qualification run.

Reference: [Supabase database function privileges and security](https://supabase.com/docs/guides/database/functions).

## Validation

- 211 focused campaign/route/Slack regression tests passed across 14 files before the final thrown-transport regression was added. The final affected files passed 8 tests, bringing the covered suite to 212 tests.
- New CAS contract tests use two independent clients against an atomic RPC double: racing claims, a committed write with lost acknowledgment, restarted recovery and stale fences, rollback/detached snapshots, bounded conflicts, malformed acknowledgments, thrown transport errors, receipt trust and concurrent callback deduplication. These are contract tests, not PostgreSQL integration tests.
- Scoped ESLint and git diff whitespace checks passed.
- TypeScript reports only the existing TS1117 duplicate properties at `lib/social-comment-inbox-ui.test.ts:51-52`, confirmed on origin/main. Generated chatbot knowledge locally to remove missing-generated-file errors. No production build was attempted with that baseline typecheck failure.
- No live workflow/customer-data smoke, provider call, charge, send, publication, scheduling, Slack activation, SMS, Gmail, social, video or YouTube execution. Expenses: $0.

Commands:

```sh
node_modules/.bin/vitest run lib/campaign-release-*.test.ts 'app/api/admin/campaigns/[id]/releases/assemble/route.test.ts' 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx' lib/agent-slack-actions.test.ts lib/agent-slack-blocks.test.ts lib/slack-action-receipts.test.ts
node_modules/.bin/vitest run lib/campaign-release-durable-store.test.ts lib/campaign-release-recovery-view.test.ts
node_modules/.bin/eslint lib/campaign-release-{durable-store,execution,adapters,coordinator,recovery-view}.ts lib/campaign-release-{durable-store,execution,recovery-view}.test.ts components/admin/CampaignReleaseReview.tsx scripts/qa/campaign-release-recovery-fixture.ts
node --import tsx scripts/build-chatbot-knowledge.ts
node_modules/.bin/tsc --noEmit --incremental false
git diff --check
```

## Visual and zero-egress evidence

Exact route: `http://127.0.0.1:3297/admin/campaigns/11111111-1111-4111-8111-000000000002?release=11111111-1111-4111-8111-000000000001`.

```sh
node --import tsx scripts/qa/campaign-release-recovery-fixture.ts
CAMPAIGN_QA_PORT=3297 node scripts/qa/campaign-release-recovery-server.cjs
CAMPAIGN_QA_PORT=3297 CAMPAIGN_QA_OUT=docs/campaign-autopilot/qa/phase3 node scripts/qa/campaign-release-recovery.cjs
```

The existing actual campaign route is exercised using local durable journal projections and synthetic API/auth responses. This UI recording does not exercise PostgreSQL. The isolated launcher removes credentials and blocks external HTTP; the browser aborts non-local requests. The Vercel analytics script was blocked. No external request was delivered, no page errors occurred, and no horizontal page/panel overflow was detected at 390/768/1440 pixels. Approval, disabled execution, partial receipt, submission, uncertain recovery, bounded-retry eligibility, receipt disclosure, terminal stop, refresh recovery and evidence navigation were exercised.

Inspected screenshots and decoded MP4 frames at all widths. Existing adjacent campaign-tab clipping at 390 pixels remains outside the changed release panel. The Playwright fixture session is required; opening the URL in an unrelated browser context does not install synthetic auth/API interception.

Selected screenshots, per-width results and H.264 MP4s are in `qa/phase3`. Captain review must keep database qualification and UI evidence distinct.

## Remaining gates

Captain review; authorized disposable/staging PostgreSQL qualification of SQL, permissions, concurrent processes and crash recovery; resolution of baseline typecheck; deliberate approval-store integration; trusted live verification and provider certification. Neither Vercel context was deployment-verified by this lane. Keep the draft unmerged and this lane visible through review and human QA. No merge, deploy or migration application is authorized by this handoff.
