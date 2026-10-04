# Phase 9: controlled provider receipt adoption

Status: local qualification and Captain-reported isolated hosted Phase 8/9 qualification of the private adoption boundary have passed. Stacked on Phase 8 / #1012, which depends on Phase 7 / #1011. Campaign Autopilot Closure remains open. This development lane performed no hosted migration, merge or deployment. Providers remain disabled. Captain-reported hosted and preview evidence, and the index-amendment verification limit, are recorded below.

## Preflight and ownership

- Base commit: `81ceff37` (`codex/campaign-provider-certification`). Main at inspection: `fc49c4e7`.
- Development branch: `codex/campaign-receipt-adoption`.
- Worktree: `/Users/vambahsillah/.codex/worktrees/af24/Portfolio`.
- Classification: **Dependent**. Origin fetched; clean detached base verified; all open PR file lists inspected. Phase 7/8 own the shared campaign contracts. Other open PRs do not overlap this write scope.
- Intended files: new adoption migration, database contract tests and runner, Phase 7/8 regression switches, and these evidence docs. No UI, route, worker, scheduler, provider adapter, credential resolver or activation flag changed.
- Integration order: #1011, #1012, then this delta. Captain owns rebasing, hosted qualification, security review and any later integration.

## Boundary and evidence

`campaign_prepare_provider_qualification` now captures an immutable binding to the current campaign attempt ID, intent ID, owner, attempt version and complete intent digest for a new controlled-delivery run. Qualification scope already binds release/action, manifest/content hashes, delivery and authorization keys, provider operation/account, destination digest, environment, credential-reference UUID/version, verifier UUID/version, currency and cap. The wrapper prevents a second controlled run for the same delivery across environments. Qualification approval references remain separate evidence pointers.

A pre-Phase-9 run without a preparation-time binding cannot be adopted. The migration deliberately does not infer or backfill original ownership. Preserve those runs for separately reviewed reconciliation; creating another run to resend is forbidden.

The new private `campaign_adopt_provider_receipt(request jsonb)` accepts only:

| Field | Contract |
| --- | --- |
| `commandId` | UUID identifying this exact adoption command |
| `receiptId`, `runId` | Existing Phase 8 receipt and bound controlled-delivery qualification |
| `scope` | Complete exact `CertificationScope`, including credential/verifier references and versions |
| `attemptId`, `intentId`, `owner`, `expectedVersion` | Current campaign ownership fence, consistent with preparation-time binding |
| `certificationId` | Exact current Phase 8 certificate for confirmed evidence; null for other outcomes |

Unknown fields are rejected. No raw provider payload, message, recipient, credential value or provider resource string is added to adoption evidence. Resource identity is a SHA-256 digest; the journal uses `sha256:<digest>` as its receipt reference. The existing manifest remains the source of approved destination content, represented by its digest in this boundary.

The boundary reads the latest immutable Phase 8 receipt. It checks scope, cumulative spend, verifier version and certificate evidence digest. Confirmed evidence requires completed readback; rejected evidence requires positive no-delivery proof. A resource claim is unique by provider/account/environment/resource digest and cannot move to another run. Imported attestations are still the responsibility of a separately qualified verifier. These database checks cannot authenticate a provider or establish current credential validity by themselves.

## Outcomes and money

| Evidence/current authority | Journal outcome | Effective campaign accounting | Successor behavior |
| --- | --- | --- | --- |
| Accepted | `submitted` | Full unspent reservation retained | Blocked |
| Uncertain, including unknown resource | `reconciliation_required` | Full unspent reservation retained | Blocked; no resend |
| Confirmed with current certificate, lease and authority | `confirmed` plus exact provider receipt | Release reservation and book cumulative final spend once | Exact eligible successor may obtain a **disabled** intent |
| Rejected with current positive no-delivery evidence | `stopped` | Release reservation and book any verified final cost once | Blocked; delivery identity retained |
| Valid final provider proof after stop, authority/source drift or lease expiry | `reconciliation_required` (preserve an already stopped state) | Reconcile known final cost once | Blocked |
| Expired/revoked provider evidence or otherwise unknown result | `reconciliation_required` | Reservation retained | Blocked |

The qualification ledger is a mirror of the campaign reservation, not an additional spend allowance. Preparation requires the exact campaign cap to be reserved. Intermediate qualification spending remains provisional; the campaign retains the full cap until current final evidence settles it. The private `campaign_provider_budget_reconciliation` view explicitly identifies the campaign journal as reservation owner and exposes effective reserved/spent amounts alongside the qualification audit projection. Consumers must use the effective columns, never sum the two projections. No old receipt or ledger entry is rewritten.

Each adoption appends an immutable request/result row and a campaign event. Final settlement appends release/spend entries. Exact command replay returns its historical result with no writes, including after restart. Changing any request field or reusing the receipt under a different command fails. A historical `completionRecorded` result is never a dispatch permit: `providerEnabled`, `dispatched` and `dispatchEligible` are always false.

## Locks, downstream authority and recovery

Lock order is journal, canonical release, sorted source/evidence rows, qualification run, then certificate. Dependency certificates are checked while the journal lock serializes campaign transitions. Database wall time is checked again after lock waits, including predecessor certificate waits in successor authorization. Canonical approval, hold/revise/stop, source fingerprint, evidence and authorization windows, action keys, dependencies, ownership/version, lease and budgets remain part of the current authority checks. Failed authority can record or financially reconcile observed facts, but cannot grant completion eligibility.

The Phase 6 authorizer and Phase 7 validator accept a provider predecessor only when its complete current attempt equals the durable confirmed adoption result and its certificate remains current and unrevoked. Existing provider/account/content/receipt/dependency-digest checks still apply. Acceptance, uncertainty, a forged receipt, changed attempt, or revoked certificate cannot qualify a successor. The successor must independently pass its own approval, source, schedule, budget and dependency checks; its mode remains disabled.

Phase 7 inspection remains available. Once an attempt has any adoption history, generic renew, release, reconcile, review-takeover and takeover return reconciliation-required without mutating the attempt, releasing money or replacing final receipts. Before adoption, Phase 8's controlled-qualification guard continues to prevent false no-invocation proof. The legacy snapshot CAS remains unable to rewrite an atomic journal.

## Security and validation

The migration is `20261004011705_campaign_provider_receipt_adoption.sql`. New tables have RLS enabled and no API-role privileges. The accounting view uses `security_invoker`. Adoption, preparation, the retained internal Phase 8 implementation, dependency verification and the immutable-evidence trigger have no EXECUTE for public/anon/authenticated/service_role. Existing scoped sandbox/recovery inspection APIs retain their prior grants; there is no new inspection grant or live execution path. Owner-only test sessions exercise private mutation functions.

Append-only triggers protect adoption commands, attempt bindings, resource claims and Phase 8 receipt evidence. Tests also check role permissions and that application code contains no adoption caller. Supabase API security guidance was checked against the current [official documentation](https://supabase.com/docs/guides/api/securing-your-api); the changelog was reviewed. This development lane ran no hosted advisor or hosted schema validation. The Captain subsequently ran hosted Phase 8/9 qualification and security/performance advisors on PostgreSQL 17.11. The disposable branch was deleted after that run. The reported foreign-key index findings were fixed in `cb44fb59` and validated locally. The index-only amendment was not rerun on hosted PostgreSQL because the single approved disposable branch had already been deleted.

Validation: 58 adoption checks, 64 Phase 8 checks, 63 Phase 7 checks, and 200 broader campaign checks passed. Physical restart and historical replay passed. Changed-file lint, guarded production build and diff checks passed. Full typecheck reports only the two existing duplicate-property errors in `lib/social-comment-inbox-ui.test.ts:51–52`, verified against `origin/main`.

Evidence and exact commands are recorded in `qa/phase9/validation.json` and adjacent text files. The disposable runner uses PostgreSQL 18.4 on loopback, stops/starts the physical database, compares persisted rows and retries the exact adoption after restart. It does not use environment files or hosted credentials.

No UI changed. Responsive route inspection and a new MP4 are therefore not applicable. Release API, assembly API and campaign-page contracts are covered in the broader suite. No live workflow or customer-data smoke was run. The Captain reported that the `Vercel – portfolio` preview for updated commit `cb44fb59` passed. `Vercel – portfolio-staging` remains not checked or deployed. This development lane performed no deployment or preview verification; the reported portfolio result is preview evidence, not production proof.

## Rollback and remaining gates

Rollback must preserve evidence and duplicate-delivery barriers. Revoke/disconnect future callers, take a consistent journal plus qualification/binding/adoption/resource/certificate/revocation snapshot, and keep immutable receipts and resource claims. Do not restore a pre-Phase-9 recovery function over an adopted attempt, erase the journal, drop the evidence tables or release an unknown reservation. A forward repair must be reviewed against the same ledger and idempotency invariants. This migration changes a recovery/security boundary; production application needs explicit current approval.

Late or stale terminal evidence remains in reconciliation. This phase intentionally supplies no lease takeover, authority renewal, credential rotation or administrative override to turn that historical result into permission. Current final proof may settle money without reopening the workflow. Expired provider evidence retains its reservation until a separately reviewed fresh-verification/reconciliation path exists. Unbound historical qualifications also remain an explicit gate.

Next: final Captain review of the stacked delta and integration sequencing, followed by qualified verifier integration and any narrowly scoped role design. Hosted Phase 8/9 qualification on PostgreSQL 17.11 has already passed as reported by the Captain. Hosted revalidation of the index-only amendment was not performed; any additional hosted run requires separately authorized capacity because the approved disposable branch was deleted. The unchecked `Vercel – portfolio-staging` context and normal integration/deployment gates remain with the Captain. Provider-specific authenticated readback, current credential/version authority, external execution approval, transport/scheduler registration, signed Slack outcome handling and supervised campaign operation remain unimplemented or unverified. SMS stays parked. Local and isolated hosted qualification do not establish one-Slack-approval campaign execution.


## Captain performance-advisor follow-up

The Captain reported passing isolated hosted Phase 8/9 qualification on PostgreSQL 17.11 before this amendment: exact confirmation/replay, disabled execution flags, recovery fencing, API-role denial, RLS/security-invoker behavior and append-only evidence. The Captain also reported deleting the disposable branch. This development lane did not repeat hosted qualification or access that database.

The reported advisor findings were addressed in commit `cb44fb59` in the Phase 9 migration with B-tree indexes on `campaign_provider_qualification_receipts(run_id, created_at, receipt_id)`, `campaign_provider_adoptions(run_id)` and `campaign_provider_resource_claims(run_id)`. Existing receipt/command/resource primary keys did not have `run_id` as a leading column. The receipt index additionally follows the per-run evidence aggregation/latest-receipt order. Large JSON payloads are excluded from these indexes.

Three real catalog assertions verify valid, ready, non-partial plain-column B-tree indexes, their exact key order and leading coverage of each run foreign key. The amended local suites pass: 58 Phase 9 checks (including these assertions), 64 Phase 8 checks, and 200 broader campaign checks. Physical restart/replay, changed-file lint and diff-check pass. Prior build, typecheck and Phase 7 evidence is retained; those checks were not repeated for this index-only amendment. Final Captain PASS remains pending. No hosted rerun of the index-only amendment was performed because the single approved disposable branch had already been deleted; the updated portfolio preview passed as reported by the Captain. Providers remain disabled; no hosted/production/provider/credential/send action occurred in this follow-up.
