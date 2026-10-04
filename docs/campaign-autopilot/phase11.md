# Phase 11: verifier provisioning and broker metadata projection

Status: local qualification; generation-only package, default off. Campaign Autopilot Closure remains incomplete. This phase prepares deployment artifacts without installing a hosted identity, resolving a credential, enabling a provider or granting resource authority. SMS remains parked. No UI changed; MP4 is not applicable.

Integration follow-up: [authority migration-order reconciliation](authority-reconciliation.md) restores missing Phase 6 helpers and intended RPC grants after a skipped Phase 6, while preserving newer function bodies. Its hosted application remains a separate Captain gate.

PostgreSQL 17 follow-up: the role-isolation guard now accepts the single automatic creator-admin membership described below. Local PostgreSQL 17.6 compatibility evidence is in [qa/creator-admin/validation.json](qa/creator-admin/validation.json). Hosted requalification remains pending; this lane changed no hosted roles or data.

## Stack and pre-flight

Base `71f2d01d`, branch `codex/campaign-verifier-provisioning`, worktree `/Users/vambahsillah/.codex/worktrees/c836/Portfolio`. Draft PR targets `codex/campaign-provider-verifier-bridge` (#1014). Integration order: #1011 → #1012 → #1013 → #1014 → Phase 11. Fetch, status/log, open PR inventory, changed-file diff and every returned open PR's file list were checked before editing. Classification: **Dependent**. The roadmap overlaps the stack; no unrelated PR owns these new provisioning files. Shared surfaces: `lib/`, `scripts/`, and a new migration.

## What the package does

The existing broker now exposes `verifier-provision`. It reads strict metadata JSON from stdin and emits a deterministic projection, SHA-256 packet digest and guarded SQL. This branch returns before inventory, environment-file, runtime-sink or resolver access. There is no CLI apply mode; all flags and positional arguments are rejected without echoing their contents. Other broker commands keep their existing behavior.

```sh
node --import tsx scripts/credential-broker.ts verifier-provision < approved-metadata.json > review-package.json
```

Input fields are defined by `VerifierProvisioningInput` in `lib/campaign-verifier-provisioning.ts`: protocol, command UUID, operation, target UUID, database name, verifier principal/UUID/version, credential-reference UUID/version/provider/account digest/environment/broker-entry digest, expected versions, and expiry. Omitted operation means `provision`.

The broker-entry digest is SHA-256 of the existing broker inventory entry ID, never a secret fingerprint or resolver path. An authorized operator must confirm that mapping separately. The generator does not claim to verify a provider credential or discover its account. UUIDs and digests are supplied metadata. One verifier identity/reference pair is pinned at initial provisioning; changing provider, account, environment or broker entry requires a new reviewed pair. No second credential store is created.

| Operation | Version rule | Result |
| --- | --- | --- |
| provision | Expected zero; new versions both 1 | Insert inactive identity/reference; remove ingest grants |
| activate | Exact current versions | Mark both active; grant only schema USAGE and ingest EXECUTE |
| rotate | Advance both versions by exactly 1 | Disable both; remove grants; revoke matching resource authorizations |
| revoke | Exact current versions | Disable both; remove grants; revoke matching resource authorizations |

Both versions advance on rotation to invalidate the entire reviewed pair. Rotation changes only metadata; it does not rotate an actual provider secret. Revoked versions cannot reactivate; a new version requires its own rotation and activation review. Existing resource authorizations stay revoked after reactivation. New resource authority belongs to a separate approved flow.

## Deployment design and action-time gate

The migration adds two empty, RLS-protected, private tables: an owner-managed deployment target pin and append-only provisioning events. It seeds no target, identity, reference, role, membership, grant or activation. The target pin supplies an independently installed target UUID, database name and environment because hosted databases often share the name `postgres`.

Generated SQL requires all of the following:

1. A direct authenticated schema-owner session with `current_user = session_user`; no `SET ROLE` impersonation.
2. A separately installed matching staging target pin. Production packets and production target pins are refused, including revocation packets. Production support requires a separately reviewed change and current authorization.
3. A separately supplied transaction-local `campaign.provisioning_authorization` setting equal to the exact packet digest. The generator never sets it. This records deliberate owner authorization, not a cryptographic proof of a human decision; the schema owner remains trusted.
4. An unexpired packet, checked after the journal lock and again before recording the event, plus exact optimistic versions and immutable provider/account/environment/broker binding.
5. An existing dedicated non-superuser LOGIN with no role memberships in either direction except the exact automatic creator-admin edge below, no role/database creation, replication or RLS-bypass privilege, and no effective campaign table or other campaign function privileges. PUBLIC privileges count. It must authenticate as its own `session_user`; shared API, authenticator and transaction-pooler identities are unsuitable.

A future authorized operator should first inspect the target's actual project identity and schema owner, review the full effective role privileges, install the target pin under separate authorization, and arrange dedicated authentication outside this package. This code never creates a login or password. After reviewing a generated packet, the operator can open an explicit transaction, supply the exact digest with transaction-local `set_config`, execute the reviewed DO block and commit. Without that separate setting it fails. This lane has not performed those steps on any hosted database.

The only grants emitted are USAGE on `campaign_verifier` and EXECUTE on `campaign_verifier.ingest(jsonb)`. Registry-table writes, Phase 8/9 mutators, memberships, default privileges and provider execution are never granted. Revocation skips excess-role-privilege prechecks so a later accidental grant cannot prevent identity deactivation; excess privileges outside this package still require incident review/removal. A missing role or corrupted binding can require owner remediation. Schema owners can bypass these safeguards by changing SQL or tables; this package is not a sandbox against an owner.

## PostgreSQL 17 creator-admin compatibility

The Captain reported staging PostgreSQL 17.6, with `postgres` as the direct session and schema owner. Creating the dedicated LOGIN produced a membership granted by `supabase_admin` to `postgres` with ADMIN enabled; revoking as `postgres` left that grant intact. The previous guard rejected it. The Captain reported both failed transactions left zero rows and no role. This development lane did not query or change staging.

[PostgreSQL 17 role attributes](https://www.postgresql.org/docs/17/role-attributes.html) describe the automatic creator grant with ADMIN enabled and INHERIT/SET disabled. The [upstream implementation](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/commands/user.c) records it under the bootstrap superuser; the [bootstrap catalog](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/include/catalog/pg_authid.dat) fixes that role's OID at 10. The bootstrap role name can vary by installation. These sources were checked October 4, 2026, along with the [Supabase role guide](https://supabase.com/docs/guides/database/postgres/roles) and [changelog](https://supabase.com/changelog). This fix uses none of the changelog's affected ltree, legacy pgcrypto, GiST-float or custom-operator features.

The exception requires **exactly one** membership touching the verifier:

- Its `roleid` is the verifier LOGIN, and its `member` is both the schema owner and the actual `session_user`.
- That owner is currently a non-superuser with CREATEROLE, matching the engine's creator path.
- ADMIN is true; INHERIT and SET are false.
- The grantor has OID 10 and is still a superuser. Neither `supabase_admin` nor any other role name grants admission.

Missing catalog matches fail closed. Additional parent or child memberships, a second grant from the owner, altered options, a different creator, a non-bootstrap grantor (including another superuser or a spoofed platform name), and excess effective privileges all fail. The existing zero-membership path remains valid. Revocation's remediation behavior and historical replay semantics are unchanged. No membership is created, removed or modified by generated SQL.

The permitted direction gives the owner administration of the verifier. It gives the verifier no owner privileges and grants the owner neither inherited verifier privileges nor SET ROLE access. ADMIN can allow a trusted owner to issue further grants; those additional grants fail the next fresh provisioning/activation/rotation check. This remains an owner-trusted deployment package.

The local compatibility harness uses real direct connections, a non-superuser schema owner, actual role creation and an arbitrarily named bootstrap role on PostgreSQL 17.6. Rejection tests snapshot registry, journal, authority and evidence state to verify no writes. Unsafe-grantor fixtures deliberately corrupt catalog rows only in the disposable cluster to exercise that predicate independently of the membership-count check. The original provisioning lifecycle, verifier ingest/restart and broker contracts are also rerun. No migration or UI change is required.

Captain's remaining hosted gate:

1. Pass the direct Supabase tool/CLI startup gate and confirm the isolated staging target and existing migration history.
2. Under the previously bounded qualification authority, inspect the actual creator and membership catalogs after role creation: schema-owner/session OIDs, owner `rolsuper`/`rolcreaterole`, grantor OID and `rolsuper`, ADMIN/INHERIT/SET, and every membership touching the verifier. Confirm the single edge above; fail closed on a mismatch.
3. Regenerate the reviewed metadata SQL from this version. In the explicit, separately authorized staging transaction, install/check the target pin, set the exact transaction-local packet digest, provision inactive, and inspect identity/reference flags, ingest grants, API/private-registry denial and unchanged journal/evidence. Roll back the synthetic qualification transaction.
4. Record before/after row and role state, actual server version and advisor results. Complete both Vercel checks during integration. Hosted activation, provider credentials/readback, production permission changes and external actions retain their separate gates.

Compatibility pre-flight: base `34c357518cede5dc200d3083e1d02c44da7f457c`, branch `codex/campaign-verifier-creator-admin`, same worktree, draft PR to `main`; **Dependent** on the merged Phase 11/reconciliation stack. Open PR inventory showed no direct file overlap. Shared surfaces are the provisioning generator in `lib/` and a new local QA runner in `scripts/`. Completed: local compatibility implementation and evidence. Next: Captain review and hosted requalification. Campaign Autopilot remains at Phase 11, default off. Expenses: $0.

## Replay, rollback and privacy

Each command UUID records a digest-only event with operation, broker-entry digest, verifier/reference UUIDs and versions. The event insert and all state/grant changes share one transaction. The same UUID and digest is a historical no-op. A changed packet under the same UUID fails. Retrying an old activation after rotation or revocation never restores access.

Rotation/revocation serializes on the same journal row as ingestion, disables the pair, removes ingest access and stamps matching resource authorizations as revoked. It preserves receipts, certificates, adoption evidence, journal reservations and spend. The immutable evidence can still be inspected by the owner. Unlike Phase 10's metadata-only deactivation, grant removal also blocks verifier callers from retrieving historical ingest results; an owner can inspect history. Rollback means revocation and reconciliation, never deletion of evidence or release of uncertain reservations. Removing the migration or fail-closed Phase 10 wrappers would widen authority and requires a separate review.

Unknown input fields are rejected with value-free errors. Tokens, provider responses, recipient/message content and resolver paths are outside the schema. Digests cannot prove that a caller supplied appropriate metadata; review input provenance. Generated output contains no credential values and cannot resolve one. Synthetic localhost authentication in database tests is disposable test setup, not a live credential.

## Validation and remaining gates

Exact commands and results are in [qa/phase11/validation.json](qa/phase11/validation.json). Tests cover deterministic generation, secret canary rejection, blocked filesystem/network/resolver access, no apply mode, no activation by default, wrong principal, API denial, environment/account/version/target binding, privilege checks, rotation/revocation, replay and atomic rollback. The full Phase 10 harness uses generated provisioning against a real adopted receipt, then verifies readiness fails after rotation while evidence/accounting survive. Phase 8/9 and atomic recovery regressions run in separate disposable PostgreSQL databases.

Public references reviewed October 3, 2026: [Supabase function security](https://supabase.com/docs/guides/database/functions), [PostgreSQL GRANT](https://www.postgresql.org/docs/current/sql-grant.html), and the [Supabase changelog](https://supabase.com/changelog). This change introduces none of the listed ltree, legacy pgcrypto encryption, GiST float or custom-operator features. Hosted advisors and hosted PostgreSQL compatibility remain unverified.

Next gate: Captain review of the stacked package and authorized staging compatibility/advisor qualification. Dedicated hosted identity creation, target-pin installation, metadata provisioning/activation, real authenticated provider adapters, exact-resource authority and supervised provider-family qualification remain separate steps. Both Vercel contexts must be checked during integration. Production permission changes require explicit current approval. Slack outcome handling and external-action approvals remain outstanding. No hosted migration, provider request, send, publish, schedule, Slack action, billing change, Vercel environment change or live credential read/write occurred. Expenses: $0.
