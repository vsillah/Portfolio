# Phase 6: atomic sandbox authority

Status: development handoff; hosted staging qualification pending. No provider execution, hosted migration, merge, deployment, or paid usage performed.

Branch: `codex/campaign-atomic-authority`. Worktree: `/Users/vambahsillah/.codex/worktrees/6215/Portfolio`. Base: `b6928793` (merged Phase 5, #1009).

## Pre-flight

Fetched origin and inspected all 31 open PR file lists. No exact campaign-release contract overlap. Unrelated campaign-enrollment tests and proposal migrations remain outside scope. Classification: **Dependent**, now based on the merged Phase 3–5 contracts (#1006–1009). The initial checkout was detached at an older guidance commit; that commit remains preserved on other branches and is excluded from this PR.

Shared surfaces: `lib/campaign-release-*`, `scripts/qa/`, and the new migration. No UI, existing source writer, canonical decision API, provider adapter, package manifest, or environment configuration changes.

## What the transaction enforces

Migration `20261003233618_campaign_atomic_sandbox_authority.sql` introduces `campaign_authorize_sandbox_intent(request jsonb)`. It locks, in order:

1. The singleton execution journal, serializing delivery identities and total reservations across releases.
2. The canonical `agent_runs` release row, so existing approval/hold/revise/stop writes participate through ordinary PostgreSQL row locks.
3. All action and planning source rows, sorted by table/id, from the fixed six-table allowlist. Existing source UPDATE/DELETE operations take conflicting locks without application changes.

Inside that transaction it verifies exact canonical record equality, manifest SHA-256, release ID, approval version and audit identity, bound journal record, immutable delivery/authorization/content keys, source fingerprints, dependency receipts/digest, schedule and evidence windows, journal version, reservation ceiling, and ownership/lease for replay. Database wall time is sampled after lock waits. Caller time cannot extend authority.

Approved v1 audit history is specifically `pending -> approve`, version 2, one authenticated-actor audit event. This matches the existing state machine: hold/revision cannot resume, stop is terminal, and repeated approve does not append an event. A future state-machine change requires a deliberate RPC revision.

The RPC creates the attempt ID, intent ID, one-minute lease, reservation ledger entry, and `atomic_sandbox_authorized` event. These commit together. Intent `mode` stays `disabled` and `status` stays `prepared`, preserving the existing review projection; `atomicRequest` records the exact sandbox authorization request. The returned protocol is `campaign-atomic-sandbox/v1` with `providerEnabled: false`.

The transaction commit is the authorization ordering point. A stop/source edit that acquires its row lock first causes claim refusal; if authorization owns the lock first, the later edit follows the committed historical intent and prevents replay. No result authorizes a later live send. No provider code exists in this boundary.

The server-owned factory supplies `AtomicCampaignAuthority` to the fence. `authorizeSandbox` performs canonical schema/audit validation before calling the RPC; SQL then locks and independently compares current authority. `dispatch` revalidates an atomic intent by exact RPC replay and still returns `dispatched: false`. Phase 5 `prepare`/refusal remains available when using the old protocol. Missing RPC, stale authority, ambiguous response, transport error, or ownership conflict never produces permission or an automatic retry.

## Idempotency and recovery

`requestId` is a UUID unique across journal intents. `deliveryKey` remains globally unique across release IDs. Exact replay returns the original attempt without a new event, reservation, version increment, or lease extension, only while all canonical/source/dependency checks pass, the original lease is current, owner/version are unchanged, and journal version is exactly the original expected version plus one.

Before-commit disconnect/rollback leaves no claim. After-commit response loss leaves the durable intent and reservation. Inspect the journal, then explicitly replay the same request if still eligible. New request IDs cannot reset delivery ownership. Expired leases, takeover, changed sources, stop/hold/revision, and intervening journal commits refuse replay. They require a future reviewed atomic recovery operation. There is no automatic release, retry, takeover, resend, or reauthorization.

The migration revokes direct service-role journal UPDATE. The two mutating RPCs use `SECURITY DEFINER` with an empty search path, qualified relations, allowlisted source identifiers, and service-role-only EXECUTE. PUBLIC, anon, and authenticated cannot invoke them. Service role retains journal SELECT. Hash helpers are not executable by API roles.

Legacy `campaign_execution_commit` refuses any journal already containing an atomic request, and refuses attempts to introduce one. This intentionally freezes legacy mutation for the **whole singleton journal** after the first atomic intent. It prevents older CAS writers from erasing evidence or recycling reservations. Further atomic claims on already-bound releases can still commit through the RPC; new hydration, synthetic recovery, and legacy submissions must wait for a dedicated atomic recovery design. Use an isolated staging database/branch with a fresh journal for qualification; this is not a general worker rollout.

## Remaining boundaries

- The RPC admits synthetic predecessor receipts only, including exact provider/account/content/type/time and digest checks. Accepted, uncertain, or live provider claims cannot unlock a dependent step. Existing sandbox-verifier receipts are conservatively refused by this RPC until separately qualified.
- Source fingerprints cover the existing approved row snapshots (excluding `updated_at`), including embedded consent/suppression/privacy evidence references. They do not independently query external consent systems or prove an external artifact remains valid. Live provider qualification must define those checks.
- PostgreSQL canonical JSON hashing matches the admitted ordinary JSON domain tested here. Large/exponent-form numbers, exotic object-key ordering, or source timestamp/number serialization differences can fail comparison closed. Qualify real staging source serialization before widening the admitted domain; never rewrite an approved fingerprint to force a match.
- A trusted database owner can still alter canonical rows or journal state; protection is against application/API role bypass, concurrent writers, stale clients and uncertain delivery state, not a malicious database owner.
- No route, cron, scheduler, worker, flag, browser action, Slack integration, provider import or transport was added. UI remains unchanged and no staging-qualified badge is claimed. No new UI QA or MP4 applies to this backend-only phase.

## Validation

Local PostgreSQL 18.4, synthetic minimal tables, actual SQL functions and distinct connections: 44 tests passed (5 adapter tests + 39 database cases), plus a physical PostgreSQL stop/start and fresh-process persistence check. The race tests wait for `pg_stat_activity.wait_event_type = 'Lock'`, proving actual lock contention in both relevant orderings.

Coverage: stop/hold/revise racing claim; source/evidence UPDATE races; stale manifest/hash/version/audit; expiry; immutable keys; missing/mismatched dependency receipts and digest; simultaneous duplicate requests; delivery ownership conflict; lease expiry/takeover refusal; journal CAS race; budget exhaustion; exact replay; ambiguous/unavailable RPC; disconnect/rollback before commit; lost response after commit; reconstruction and physical restart; anon/authenticated rejection; service-role direct-write rejection; legacy forgery/erase refusal; SQL/TypeScript hash parity; dispatch fence remains disabled.

The broader focused suite passed 176 tests across 15 files; the 39 database cases are intentionally opt-in there and run separately by the disposable runner. Changed-file lint and `git diff --check` pass. Guarded production build passes (compile, application type validation, static generation). Full `tsc` reports only existing duplicate properties at `lib/social-comment-inbox-ui.test.ts:51–52`, verified from `origin/main`. An intermediate build caught a new projection type mismatch; it was fixed without changing UI output, and the final build passed. A concurrent typecheck/build attempt raced generated `.next/types`; final typecheck was rerun after build completion.

Evidence: [local SQL results](qa/phase6/postgres-results.txt), [validation summary](qa/phase6/validation.json).

Commands from this worktree:

```sh
# Temporary tooling only; no repo dependency change.
npm install --prefix /private/tmp/campaign-phase6-postgres --no-audit --no-fund embedded-postgres@18.4.0-beta.17
CAMPAIGN_TEST_POSTGRES_MODULE=/private/tmp/campaign-phase6-postgres/node_modules/embedded-postgres/dist/index.js node scripts/qa/campaign-atomic-postgres.mjs
node_modules/.bin/vitest run lib/campaign-release-*.test.ts 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/api/admin/campaigns/[id]/releases/assemble/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx'
node_modules/.bin/eslint lib/campaign-release-atomic-authority.ts lib/campaign-release-atomic-authority.test.ts lib/campaign-release-dispatch.ts lib/campaign-release-activation-server.ts scripts/qa/campaign-atomic-postgres.mjs scripts/qa/campaign-atomic-restart.ts
node --import tsx scripts/build-chatbot-knowledge.ts
node scripts/qa/campaign-release-recovery-server.cjs --build
# Run after the build, not concurrently with .next generation:
node_modules/.bin/tsc --noEmit --incremental false
git diff --check
```

The runner accepts only a loopback database named `campaign_phase6_test`; never point this destructive fixture suite at a hosted database. It starts an isolated cluster with synthetic credentials, stops it on completion, and prints its temporary data path. No provider calls or live customer-data smoke occurred. Local PostgreSQL 18.4 results are not hosted Supabase/PostgreSQL-version qualification.

## Captain staging qualification procedure — pending

1. Review this migration's privilege change, definer functions, global legacy-CAS freeze, and rollback plan. Follow the captain startup gate and migration authority rules. Keep all provider workers disconnected.
2. Use an isolated staging branch/database with the real source schemas and **no shared execution journal workload**. Capture its project/branch ID, PostgreSQL version, migration list, empty journal snapshot and current grants. If the journal contains any pre-existing attempt, stop and select a separate isolated target; do not reset it.
3. Apply the Phase 3 journal migration, grant correction, and Phase 6 migration only as needed through the approved captain migration path. Verify service_role has journal SELECT but no INSERT/UPDATE/DELETE/TRUNCATE, and only service_role can execute the two mutating RPCs. Inspect Supabase advisors for this privilege change. No application or provider activation is needed.
4. Create a synthetic campaign/source through the existing staging fixture procedure. Build the manifest from the returned **real row shape**, using `campaignSourceFingerprint`; use a source account such as `synthetic-account`, no private recipients/assets, one currently due action, a future evidence/authorization window, and a 50-cent sandbox reservation under a 100-cent cap. Save it through `createCampaignRelease`, approve with `decideStoredCampaignRelease`, then call `bindStoredCampaignApproval` with the exact release ID/hash/version. Capture IDs and hashes in the staging evidence packet, not raw private rows.
5. From the unregistered server factory, call `storedCampaignDispatchFence(client).authorizeSandbox({ releaseId, hash, approvalVersion: 2, actionId, owner: 'staging-qualification', journalVersion: snapshot.version, requestId: randomUUID(), dependencyDigest: releaseHash({}) })`. Persist this exact request before invocation. Verify one journal version increment, one claim, one reserve ledger entry, `atomicRequest`, event `atomic_sandbox_authorized`, `mode: disabled`, and no provider traffic. Immediately repeat the exact request: IDs, lease, reservation and version must be unchanged. `dispatch(attemptFence(attempt), committedVersion, new Date())` must return `dispatched: false`.
6. Repeat the real transaction races from this test file with separate connections and synthetic staging records, preserving the fixture preparation inside rolled-back transactions where possible. Use `BEGIN`, the canonical/source UPDATE or authority RPC, observe the second connection waiting on a row lock, then COMMIT/ROLLBACK and inspect both outcomes. Retain journal evidence for any committed intent; never delete reservations to reset a trial. Use separate isolated targets for committed scenarios when the global legacy freeze prevents rebinding. Test the actual target's numeric/timestamp/source serialization and privileges.
7. Capture migration identity, result counts, privilege/advisor output, zero-provider-egress evidence, persisted row state, and the restore/restart evidence possible in that staging environment. Report hosted qualification separately from these local results. Stop before production application or provider activation. A production grant/security-boundary change needs explicit current approval under the captain migration rule.

## Rollback strategy

Before application: disconnect all journal consumers and export the journal plus function definitions/grants. Migration DDL is transactional; an application failure rolls back the schema change.

After any committed intent: preserve the journal, reservations and current direct-write revocation. The safe operational rollback disables mutation rather than restoring an old writer that can erase atomic intent history:

```sql
begin;
revoke execute on function public.campaign_authorize_sandbox_intent(jsonb) from service_role;
revoke execute on function public.campaign_execution_commit(bigint,jsonb) from service_role;
commit;
```

Snapshot reads remain available. Do not drop the journal, remove atomic markers, restore service-role UPDATE, or reinstall the old unrestricted CAS after an intent exists. Full schema downgrade requires a separately reviewed recovery/export plan. No rollback command was run on a hosted database.

## Roadmap

Completed: local SQL authority, server adapter/fence integration, atomic evidence persistence, privilege fencing, concurrency/restart tests and guarded build. Next: captain review, authorized isolated staging qualification on the actual schema/version, then an atomic recovery design. Live provider certification, irreversible handoff semantics, worker/scheduler integration, signed live Slack outcome reporting and supervised end-to-end campaigns remain separate gates. This phase does not close Campaign Autopilot or authorize a provider.
