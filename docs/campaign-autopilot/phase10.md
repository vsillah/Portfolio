# Phase 10: authenticated provider verifier bridge

Status: development, local qualification only. Providers remain disabled. The bridge turns a trusted verifier's readback attestation into the existing Phase 8 receipt/certificate and Phase 9 adoption transaction. It does not obtain live provider evidence. Campaign Autopilot Closure remains incomplete.

## Stack and scope

Base `7cc1ee7c`, branch `codex/campaign-provider-verifier-bridge`, worktree `/Users/vambahsillah/.codex/worktrees/7098/Portfolio`. Integration order is #1011 atomic recovery → #1012 provider certification → #1013 receipt adoption → Phase 10. Draft PR targets `codex/campaign-receipt-adoption`. The required fetch, clean status, log, open PR inventory and file-overlap check classified this lane **Dependent**. No unrelated lane owned the new verifier files; the campaign roadmap is shared with the predecessor stack.

Changed surfaces: one server-only verifier module, its contract/database tests, a disposable PostgreSQL runner, one migration, and campaign documentation. No route, worker, UI, cron, provider SDK, transport, runtime flag, login, credential resolver or Slack dispatcher is registered. MP4 and responsive viewport QA are not applicable because this phase changes no user-facing rendered surface.

## Contract and transaction

The server registry supports LinkedIn, Instagram, Facebook, X, TikTok, Gmail, HeyGen, YouTube and manual-social. It starts empty. Its verifier callback inspects a strictly typed, already-observed attestation; trusted reviewed server code must authenticate and read back the existing resource in a future separately authorized adapter. The interface provides no provider execution capability. Injected JavaScript is trusted code, not a sandbox; adding an adapter still requires source review and provider-family qualification.

Social proof must match the published resource, account, exact content and destination/visibility. Gmail proves the authorized sent-message record, never inbox placement or reading. HeyGen requires a completed job and approved input/asset identity. YouTube requires the exact video/channel, processing completion and approved visibility. Manual-social confirms the exact operator handoff, never publication. SMS is rejected and remains parked.

`campaign_verifier.ingest(jsonb)` performs a single PostgreSQL transaction:

1. Authenticate the dedicated database connection using `session_user` and an owner-maintained verifier UUID/version mapping. JWT fields, request-body identity and `SET ROLE` do not supply this identity.
2. Lock the campaign journal and check exact command replay. An exact retry returns immutable historical evidence; it grants no fresh authority. Any changed field under the same command fails.
3. Check current attempt/intent/owner/version, canonical approval/source evidence, provider/action/account/content/destination/environment, qualification run and preparation-time intent binding.
4. Lock and validate the current credential-reference UUID/version and verifier identity/version. Check the exact preauthorized resource digest, scope digest, approval-reference UUID, revocation and finite authorization window. Recheck source authority and time after lock waits.
5. Normalize accepted/uncertain/confirmed/rejected evidence. Unknown status, incomplete confirmation or rejection without complete positive no-delivery proof becomes uncertain. A confirmed observation requires an exact certificate UUID; other outcomes cannot supply one.
6. Invoke Phase 8 receipt recording, certificate issuance when confirmed, and Phase 9 adoption. Any failure rolls back all three. Existing monotonic cumulative spend and campaign reservation rules remain authoritative. Accepted/uncertain retains the full campaign cap; the qualification accounting is a mirror and must never be added to it.
7. Append a digest-only bridge record and privacy-safe result. It includes run, receipt/certificate, scope/resource digest, attempt version, outcome and effective accounting. All execution flags remain false.

The resource authorization must already exist before the observation, and the qualification must already be bound to a pristine controlled campaign intent. This bridge does not adopt arbitrary historical resources or manufacture original delivery authority. Reconciliation after stale ownership/authority remains gated; a failed readback command preserves the existing reservation.

## Credential broker boundary

The existing `scripts/credential-broker.ts` owns Infisical/1Password resolution and runtime sinks. Its inventory uses broker-specific string identifiers, not the campaign UUID/version protocol. Importing or executing it here would load environment or credential material and is deliberately avoided.

`verifierCredentialReferenceSchema` is the strict metadata handoff: reference UUID, version, provider, account digest, environment and active status. The private database projection enforces these fields at ingestion and fresh readiness checks. A future approved broker synchronizer must attest and install that mapping, advance the version on rotation, and deactivate it on revocation. That synchronizer is not implemented or activated in this phase. Reference presence does not prove provider credential validity. No raw credential, token, resolver path, provider response, recipient list or message body belongs in the attestation or bridge evidence.

## Security and compatibility

The migration creates a non-exposed `campaign_verifier` schema with RLS enabled on every table. PUBLIC, anon, authenticated and service_role receive no schema usage, ingest execution or private-table rights. There are no login creation, role memberships, provider registrations or data seeds. Registry tables are empty and inactive by default. A future dedicated non-superuser LOGIN must receive only schema usage and `ingest(jsonb)` execution, never registry writes or Phase 8/9 mutator access. Do not use a shared `postgres`, `authenticator`, API role, transaction-pooler identity or service-role connection: the actual `session_user` must identify the verifier. No hosted role design or grants were performed here.

The function uses SECURITY DEFINER with an empty search path because it composes existing owner-only Phase 8/9 operations. All object references are schema-qualified. The database owner is part of the trust boundary; this does not protect against a compromised owner or a malicious authorized verifier attesting false provider evidence. Dedicated verifier authentication and provider-specific evidence authentication are separate requirements.

The only service-role grant is the preexisting read-only certification inspection entry point. Its wrapper and the dependency predicate now require current bridge evidence, active verifier/credential versions and an unrevoked resource grant. Consequently, owner-seeded Phase 8/9 certificates without Phase 10 provenance cease to report current readiness or satisfy dependencies. They remain stored and readable to the owner. This is an intentional fail-closed compatibility change; never backfill fabricated verifier provenance to make an old certificate pass.

Evidence and adoption rows are append-only under normal SQL updates/deletes. Exact retry after revocation can return the old result, while fresh readiness/dependency checks fail. Treat the returned result as history, even when it says `completionRecorded: true`; all dispatch flags remain false.

`campaign_verifier.inspection` is an owner-only security-invoker view combining immutable result evidence with current grant expiry/revocation and qualification/effective campaign accounting. It can support a later signed Slack outcome projection, but no notification permission, audience rule or dispatch has been added. Operators must still check current certification readiness rather than interpreting a historical result as current permission.

## Validation and limits

See [validation.json](qa/phase10/validation.json) and the adjacent logs for exact commands and results. Tests use synthetic resources, disposable local PostgreSQL 18.4, separate authenticated verifier logins and empty process environments. The runtime is stopped after each run; synthetic database files remain temporary. The shared dependency tree was reused only after verifying an identical lockfile.

Coverage includes every provider family, empty registry, reference/verifier version drift, wrong scope/resource/account/environment/content, expired/future/stale authority, source and approval drift, accepted/uncertain/final outcomes, positive no-delivery, cap overflow/regression, exact/conflicting/concurrent replay, disconnect rollback, physical database restart, revocation, API-role/unrelated-login denial, spoofed claims, downstream atomic rollback and absence of outbound registrations. Physical restart compares journal, qualifications, receipts, certificates, revocations, bindings, adoptions, resource claims and verifier tables before/after, then replays the saved final command.

Phase 6–9 regression databases exercise their original migrations; Phase 10's suite applies the full stack and tests its intentional stricter certificate readiness. The generic campaign run skips database-only cases, which run separately through the disposable runners. No hosted smoke, hosted advisors, production migration, provider call, credential read/change, Vercel environment change, send, publish, schedule, render, Slack action or billing occurred. Expenses: $0. Neither Vercel deployment context was exercised by this lane; Captain must verify both during integration.

Current official sources checked October 3, 2026 (America/New_York): [Supabase changelog](https://supabase.com/changelog), [database function security and execution grants](https://supabase.com/docs/guides/database/functions), [API schema/grant security](https://supabase.com/docs/guides/api/securing-your-api), and [PostgreSQL 15.19/17.11 breaking changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). The migration introduces none of the affected legacy encryption, ltree, GiST-float or custom operator features. Local PostgreSQL 18.4 results do not substitute for a Captain-authorized hosted compatibility/advisor run.

## Rollback and next gates

No hosted rollback is needed for this lane. If later installed, stop the dedicated ingestion caller, revoke its schema/function grants, deactivate the verifier/reference and revoke the resource authorization under Captain control. Preserve evidence, certificates and journal accounting for reconciliation. Keep the fail-closed inspection/dependency wrappers; removing them would widen readiness to unbridged old certificates. Never release an uncertain reservation or delete evidence as rollback. A full schema/code reversal requires a reviewed migration and explicit authorization because this phase changes authorization semantics.

Next: Captain review and stacked integration; authorized isolated hosted qualification/advisors; both Vercel contexts; a separately reviewed dedicated-login/projection deployment; real provider-specific authenticated readback adapters and exact resource authority; supervised evidence qualification; signed Slack outcome handling. Provider execution activation and external-action approvals remain separate. This phase supplies a tested evidence boundary, not production certification or one-Slack-approval campaign execution.
