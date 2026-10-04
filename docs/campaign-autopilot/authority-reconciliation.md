# Campaign authority migration-order reconciliation

Status: local qualification only, October 4, 2026 (America/New_York). This repairs the dependency and privilege gap reported by Captain after Phases 7–11 were installed on staging without Phase 6. Hosted state was not queried or changed by this lane. Campaign Autopilot Closure remains at Phase 11's default-off provisioning gate.

Base `2a0af6b5154ec260e1f242a61c831baa1675aae0`, branch `codex/campaign-authority-reconciliation`, worktree `/Users/vambahsillah/.codex/worktrees/c836/Portfolio`. Required fetch/status/log/diff and open-PR file inventory passed. Classification: **Dependent** on merged #1011–#1015; no open lane owns the new files. Draft PR targets `main`.

## Repair scope

`20261004100212_campaign_authority_reconciliation.sql` runs in one transaction:

- Create or replace `campaign_authority_json(jsonb)`, `campaign_authority_hash(jsonb)` and `campaign_authority_keys(jsonb,text)` with the original Phase 6 definitions.
- Revoke all helper rights from PUBLIC, anon, authenticated and service_role. Their immutable, strict, security-invoker behavior and empty search paths stay the same.
- Revoke all rights on `campaign_authorize_sandbox_intent(jsonb)` and `campaign_execution_commit(bigint,jsonb)` from those four principals, then grant EXECUTE to service_role.

Neither authorization nor commit is replaced. No schema, table, role, membership, row, credential reference, verifier identity or provider activation is introduced. Owner privileges remain implicit; the API grant is service_role-only. Grants to any unrelated custom role are outside this narrowly specified repair.

Do not replay the original Phase 6 migration after newer phases: it also replaces authorization and commit with older definitions. This forward migration restores just the missing helpers and reasserts the intended grants. Repeated execution preserves helper OIDs and all current function bodies while correcting drift in the specified principals' ACLs.

## Reproduced state and verification

Two disposable PostgreSQL 18.4 databases use the complete relevant campaign sequence: base journal + service-role journal grants + Phases 7–11, with Phase 6 omitted in one database and included in the other. Minimal synthetic source tables provide the existing schema prerequisites. This is the full campaign authority stack, not a replay of every unrelated Portfolio migration.

Without Phase 6, all three helpers are absent and authorization has `proacl = NULL`; PUBLIC, anon, authenticated, service_role and an unrelated role have effective EXECUTE. This exposure arises from the actual migration sequence, with no fixture grant added to manufacture it. Commit is already service_role-only. A valid synthetic authorization fails at the missing hash helper; all fixture writes roll back.

The Captain's reported authorization hash `ced09628b28bf79fe539dd65a795390e` matches `md5(pg_get_functiondef(...))`. Its `md5(prosrc)` is `0224db60e6fc894181a320365c4c7d66`. Commit's definition/body MD5 values are `b043abaa7512f64743853b9f4394bf94` and `d48f0a1ca617a34cb4a705fb1a1e213d`. Both modes reproduce these values and retain byte-identical definitions, OIDs, owners and execution attributes after repair and repeated repair.

The tests exercise canonical JSON/hash parity, broadcast and relationship action keys, actual role denial, service-role entry into both RPCs, disabled sandbox authorization, exact retry, reservation preservation, unrelated legacy CAS progression and rejection of legacy mutation of an atomic attempt. Semantic writes occur only inside rolled-back transactions. Before/after row snapshots are identical; business/evidence tables stay empty and the pre-existing journal singleton stays unchanged. No provider call or credential access occurs.

See [validation.json](qa/authority-reconciliation/validation.json) for exact commands, counts and adjacent logs. The generic contract run skips PostgreSQL-only cases; this focused runner exercises both migration-order scenarios directly. No UI changed; MP4 and responsive QA are not applicable. No build is required for this migration/test-only change; typecheck and changed-file lint are recorded separately.

Public references checked: [Supabase function privileges](https://supabase.com/docs/guides/database/functions), [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html), and the [Supabase changelog](https://supabase.com/changelog). The migration uses none of the listed ltree, legacy encryption, GiST float or custom-operator features. Hosted compatibility and advisors remain Captain gates.

## Next gate and rollback

Captain must review and merge the draft, then use the existing authorized staging qualification flow to apply this forward repair and verify all five function ACLs, helper behavior, unchanged authorization/commit definition hashes and unchanged persisted rows. This lane stops before merge or hosted application. Production grant changes require explicit current approval under the migration authorization rule. Both Vercel contexts remain integration checks.

A blind rollback would restore public authorization exposure or remove helpers required by later phases. Keep the repair in place if application deployment is rolled back. Any SQL reversal needs a separately reviewed forward migration and applicable authorization. Providers remain disabled; SMS remains parked. Expenses: $0.
