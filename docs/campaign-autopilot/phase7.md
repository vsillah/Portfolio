# Phase 7: explicit atomic recovery

Status: local development qualification. Providers remain disabled. No hosted migration, deployment, provider invocation, external send, or paid usage occurred.

## Pre-flight and scope

Base: `fc49c4e7345dd51a7764788346ea179c218ea4f5` (Phase 6, #1010). Branch: `codex/campaign-atomic-recovery`. Worktree: `/Users/vambahsillah/.codex/worktrees/2633/Portfolio`.

Classification: **Dependent**, based on merged Phase 6. Fetched origin and inspected all 31 open PR file lists: no exact overlap with the campaign-release contracts. Shared surfaces touched: campaign libraries, local QA scripts and a new Supabase migration. The initial checkout's instruction-only commit was preserved as `codex/campaign-recovery-start-backup`; this branch starts at the requested main commit. No unrelated changes are included.

## Recovery contract

`campaign_recover_atomic_intent(request jsonb)` is an explicit service-role command boundary. `storedCampaignAtomicRecovery(client, authenticatedPortfolioActor)` is its server-only factory. There is no registered route, cron, scheduler, worker, provider adapter, browser action or transport. The trusted server caller must establish the Portfolio actor's authentication and recovery authorization before constructing the factory. Supplying an actor string is not an authentication mechanism.

Each command identifies the exact release/hash, delivery/authorization/content keys, attempt ID, intent ID, current owner and expected attempt version. A UUID command ID plus the entire request is persisted in an append-only receipt table, outside the legacy journal JSON. A conflicting reuse of a command ID fails. Exact replay returns its original historical receipt, even if subsequent decisions or recovery changed state. **A replay is not a fresh eligibility check or delivery permit.** Use a new `inspect` command for current state.

The transaction takes the established locks: singleton journal, canonical `agent_runs` release, then all allowlisted source rows in sorted table/ID order. `campaign_validate_atomic_recovery` reproduces the Phase 6 manifest, audit, binding, source, time, dependency and budget validation without claiming or replaying authorization. This separate private validator is intentionally versioned with the Phase 6 contract; future authority changes must update both validators and their qualification tests.

The original intent, atomic request, immutable keys, attempt ID and existing event history remain unchanged. A mutating recovery increments the attempt and journal versions and appends an event. Inspection and takeover review write only a command receipt. Every result explicitly reports `providerEnabled: false` and `dispatched: false`.

| Command | Result and boundary |
| --- | --- |
| `inspect` | Returns the exact historical intent plus current eligibility and no-invocation evidence, including after lease expiry, stop or source drift. Does not extend a lease. |
| `renew` | Same current owner only; revalidates all authority and reservation identity. Extends the disabled intent's lease by 60 database-clock seconds, including an expired lease. Never creates a new intent or delivery key. |
| `reconcile` | Moves a nonterminal attempt to reconciliation and retains its reservation. Does not accept provider claims or manufacture delivery receipts. |
| `release` | Closes the attempt as `stopped` and releases its reservation only with positive no-invocation evidence from the disabled Phase 6 contract. Does not make the delivery key reusable. |
| `review_takeover` | Separate recorded review of an expired lease, exact current fence and distinct proposed owner; requires a review note. Review expires after five minutes and grants no ownership. |
| `takeover` | Requires that review ID, same proposed owner and unchanged attempt fence, expired lease, and fresh authority checks. Transfers only reconciliation ownership; preserves the original intent and authorization. |

Unsafe renewal/takeover requests after hold, stop, revision, source/dependency drift, expired authority or budget inconsistency yield reconciliation-required with reservation retained. A later explicit `release` may close a disabled, proven-uninvoked intent even after approval is withdrawn. It never retries or reauthorizes delivery.

No-invocation proof admits only the known disabled/prepared Phase 6 intent, zero spend, one try, empty callbacks, absent receipt/verification, finite lease and known authorization/recovery event history. Unknown fields, submitted state, provider evidence or unrecognized events retain funds. An unknown-outcome event is sticky through subsequent reconciliation: changing the state label cannot manufacture no-delivery proof. Resolving actual provider outcomes remains a separately reviewed future contract.

## Legacy writer compatibility

Phase 6 froze the entire singleton after its first atomic intent. The replacement `campaign_execution_commit` permits unrelated releases to prepare, approve, claim and progress through the existing journal API. It refuses changes to:

- Atomic attempts, original intent, history or their delivery/authorization/attempt identity aliases.
- Any attempt on an atomic release, protecting predecessor receipts and budget accounting.
- That release's approved historical record, approval binding and associated ledger entries.
- New or changed atomic markers introduced by a legacy writer.

The release-level protection is deliberately conservative: legacy work on the **same** atomic release remains fenced. Unrelated releases continue. A stale whole-journal writer gets an ordinary CAS conflict, reloads the current atomic records and may safely retry its unrelated transition. Recovery uses the exact attempt fence rather than the global journal version, so unrelated commits do not invalidate recovery eligibility.

Migration `20261004001737_campaign_atomic_recovery.sql` was generated with `supabase migration new campaign_atomic_recovery`. It preserves the existing journal data and grants. The new receipt table has RLS and no API-role table access. Only service_role can execute recovery; PUBLIC, anon and authenticated cannot. The validator has no API-role EXECUTE. The security-definer functions use an empty search path and qualified tables. This follows the existing internal RPC privilege boundary; it is not a public authentication endpoint. [Supabase function privilege guidance](https://supabase.com/docs/guides/database/functions).

## Local evidence

The disposable runner tests actual PostgreSQL functions on PostgreSQL 18.4, with separate connections. Lock races wait until `pg_stat_activity` reports lock contention. It applies the migration over a populated Phase 6 journal and confirms byte-equivalent JSON state before and after DDL. A physical stop/start and a fresh Node process compare the entire persisted journal and receipt table and replay the saved command.

Coverage includes exact inspection, lease expiry, renewal, takeover refusal and reviewed transfer, expired/stale reviews, concurrent renewal/takeover, both lock orderings for stop/hold/revise and source edits, audit/manifest/binding drift, actual predecessor receipt changes, budget, before/after-commit response loss, duplicate commands, identity replay conflicts, legacy mutation/alias isolation, unrelated full journal progression and both CAS/recovery race orderings. Adapter tests reject ambiguous and unavailable responses without retry.

Evidence is in [qa/phase7](qa/phase7/validation.json). Hosted PostgreSQL/Supabase qualification and real customer-data smoke remain unperformed. The existing source fingerprint and canonical JSON serialization limitations from Phase 6 remain. A database owner can bypass application privileges; this protocol does not defend against a malicious database owner.

No UI was changed; no new route or operator projection was connected. Desktop/mobile visual QA and MP4 are not applicable to this backend-only change. The existing Campaign releases UI still does not imply a live journal connection.

Commands:

```sh
CAMPAIGN_TEST_POSTGRES_MODULE=/private/tmp/campaign-phase6-postgres/node_modules/embedded-postgres/dist/index.js node scripts/qa/campaign-atomic-recovery-postgres.mjs
node_modules/.bin/vitest run lib/campaign-release-*.test.ts 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/api/admin/campaigns/[id]/releases/assemble/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx'
node_modules/.bin/eslint lib/campaign-release-atomic-recovery.ts lib/campaign-release-atomic-recovery.test.ts lib/campaign-release-activation-server.ts scripts/qa/campaign-atomic-recovery-postgres.mjs scripts/qa/campaign-atomic-recovery-restart.ts
node --import tsx scripts/build-chatbot-knowledge.ts
node scripts/qa/campaign-release-recovery-server.cjs --build
node_modules/.bin/tsc --noEmit --incremental false
git diff --check
```

The test runner accepts only loopback database `campaign_phase7_test`, uses synthetic credentials and source rows, and stops its isolated cluster on completion. It requires local process/shared-memory permission. Never use these destructive fixture tests against a hosted target. Typecheck runs after build to avoid racing `.next/types` generation. Existing baseline errors at `lib/social-comment-inbox-ui.test.ts:51–52` are recorded separately.

## Captain qualification and rollback

1. Review the SQL privilege boundary and conservative release-level isolation. Run the captain Supabase startup gate before hosted work. Confirm the target's migration history, PostgreSQL version and actual source shapes.
2. On an authorized isolated staging target with providers disconnected, apply the journal/Phase 6 prerequisites and this migration. Capture the exact journal before/after upgrade and function/table grants; run advisors. No production application is authorized by this development handoff.
3. Prepare and approve synthetic sources through the real staging schemas, bind the release, and create a disabled atomic intent. Capture the exact attempt, original request and immutable keys. Use no real recipients or private source material.
4. Construct the unregistered server recovery factory from an authenticated Portfolio operator context. Persist each full command before calling it. Run inspection, same-owner renewal, explicit reconciliation/release, and separate takeover-review/transfer commands. Verify disabled result flags, unchanged intent, version fences, reservation ledger and receipt history. Use a new command ID for fresh inspection; exact command replay is historical.
5. Repeat concurrency/restart cases with distinct connections using the actual target's schema and serialization. Verify unrelated legacy work continues and atomic release/ledger/identity aliases are rejected. Record persisted row state and zero provider egress. Hosted qualification is separate from these local tests.

Safe rollback retains evidence and stops mutation. Disconnect consumers, snapshot the journal and recovery command table, then revoke service-role EXECUTE on recovery, atomic authorization and legacy commit. Keep SELECT/snapshot available. Do not restore unrestricted legacy CAS or direct journal UPDATE, drop command receipts, erase intents or recycle delivery keys. A full downgrade after recovery requires a separately reviewed evidence-preservation plan.

## Roadmap

Completed: explicit local recovery boundary, migration-compatible legacy isolation, server adapter and concurrency/restart qualification. Next: Captain review and authorized isolated hosted qualification. Production migration authorization, live-provider outcome verification, worker/transport activation and supervised end-to-end campaigns remain separate gates. No change to provider-disabled status.
