# Phase 8: provider certification boundary

Status: local development qualification, stacked on Phase 7 / PR #1011. No provider is live-certified by this work. Campaign Autopilot Closure and one Slack approval driving a recoverable multi-channel campaign remain open.

## Pre-flight

- Base: `fae4e9ba` (`codex/campaign-atomic-recovery`, #1011); main at inspection: `fc49c4e7`.
- Branch: `codex/campaign-provider-certification`.
- Worktree: `/Users/vambahsillah/.codex/worktrees/d0b3/Portfolio`.
- Classification: **Dependent**, intentionally stacked on #1011. Fetched origin; inspected all open PR file lists. Only #1011 overlaps campaign contracts. Shared files include the server factory and recovery test/runner; other changes add the certification library, dispatch-fence inspection, migration and evidence.
- Recommendation: review this delta against the dependency branch, integrate Phase 7 first, then let the Captain rebase/retarget Phase 8. No merge or deployment is performed by this lane.

## Implemented contract

`CertificationScope` binds the exact provider, operation, account, release/action ID, manifest/content hashes, delivery/authorization keys, destination digest, environment, credential-reference UUID and version, mode, USD spend cap, receipt type, and verifier UUID/version. The destination digest covers recipient/consent/suppression identities and copy metadata, including resource/visibility selections. The immutable manifest hash covers the remaining schedule, sources, assets and approved inputs. Credential references identify a separately managed credential; they never contain or resolve a credential here.

Four durable tables hold qualification runs, append-only receipt evidence, certificates, and permanent revocations. They are outside the legacy journal so older serializers cannot discard them. Evidence and provider resource identities are hashes; raw messages, provider payloads and secrets are not stored. An evidence digest must resolve to a separately controlled evidence packet for a real verifier; a hash alone does not prove a provider result.

Qualification stages are `local_contract`, `hosted_contract`, and `provider_readback`. Local/hosted contract results cannot issue certificates. A provider-readback run must use a hosted environment and finish with current, exact-scope completion evidence before issuance. The stage labels record separate classes of evidence; they do not automatically promote a run or enforce a cross-stage approval workflow. That workflow remains part of the gated verifier integration.

`no_delivery` and `controlled_delivery` are distinct exact scopes. No-delivery completion requires explicit no-delivery evidence. Controlled delivery requires a current disabled atomic intent, and reserves the qualification cap before any future invocation could begin. A separate approval-reference UUID is mandatory. This reference is an evidence pointer, not authenticated approval or spending authority.

Each run reserves its entire cap. Accepted and uncertain outcomes retain the unspent balance; cumulative spend cannot decrease or exceed the cap. Confirmed completion or rejected-with-no-delivery-proof settles that run once. This is a durable reservation/receipt accounting boundary, not an enforceable provider billing cap or a permission to spend. No provider transport exists. A future provider integration must enforce its hard cap before execution and account qualification spending against the authorized campaign/qualification budget; this phase deliberately retains campaign reservations independently.

Exact run/receipt/certificate replay returns historical identity or outcome without duplicate spend. Conflicting replay fails. Uncertain outcomes can retain an unknown resource identity; the first authenticated readback binds it. Once known, resource identity cannot change or be cleared between receipts. Uncertainty cannot regress to acceptance; completion requires explicit readback. Expired uncertain runs retain funds. A new run ID cannot recycle the same scope/stage, and controlled delivery has a unique delivery-key/environment fence across release revisions. Requalification of a consumed scope needs a separately reviewed evidence-preserving protocol; deleting old evidence is not a retry mechanism.

## Atomic authority and recovery

`storedCampaignDispatchFence(...).inspectProviderReadiness(fence, scope)` reads the current attempt fence, then calls `campaign_inspect_provider_certification`. SQL locks the journal, canonical approval/source rows through the Phase 7 validator, then certificate. It validates exact account/action/destination/budget identity, approval, source evidence, dependencies, ownership/version and lease. Authority time is checked again after certificate-lock waits. Expiry, revocation, changed credential reference/version, verifier identity/version, environment or mode removes readiness.

The result contains concise blocker, evidence digest, certificate ID and one next action. This is available through the existing unregistered server boundary; it adds no dashboard, HTTP endpoint, scheduler or worker. `certificationReady` means that this exact no-delivery evidence is current under the inspected atomic state. **Every result has `providerEnabled: false`, `dispatchEligible: false`, and `dispatched: false`.** A prior Phase 6 authorization or Phase 7 `eligible` result is never a provider permit. `dispatch` retains its unconditional disabled behavior.

Controlled qualification may already have performed the authorized action, even when its response was lost before evidence import. Therefore any controlled run, including merely prepared, fences recovery's no-invocation proof for that delivery key. Recovery retains the campaign reservation and requests reconciliation. Inspection reports `qualification_delivery_requires_reconciliation` even if a separate no-delivery certificate exists. Preparation and recovery share the journal-first lock order: preparation first retains money; release first prevents a new controlled run. A controlled qualification receipt is not automatically imported as campaign completion, does not unlock downstream actions, and never causes a resend. A separately reviewed receipt-adoption/reconciliation protocol is still required.

## Trust and privilege boundary

Only `campaign_inspect_provider_certification` is executable by service_role. Qualification preparation, receipt ingestion, certificate issuance and revocation are private database functions with no PUBLIC, anon, authenticated or service-role EXECUTE. All four tables have RLS and no API-role access. Private functions are exercised by the disposable test database owner only. The trusted database owner can forge data; these controls do not protect against that owner.

This is deliberate: provider-specific authenticated readback verifiers have not been installed or qualified. No application caller can manufacture a live certificate by supplying a `confirmed` label. Future grants, an authenticated issuer/verifier service, credential resolution and provider calls require their own review. The server factory and type names do not establish authentication. A future server caller must supply environment/credential/verifier identities from trusted runtime configuration, never from a browser assertion.

Security-definer functions use empty search paths and qualified relations, following [Supabase function privilege guidance](https://supabase.com/docs/guides/database/functions). The changelog was checked, including the [September PostgreSQL minor-release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes); this migration adds none of the listed legacy-cipher, custom-operator, ltree or btree_gist usages. Hosted engine/version and advisor checks remain pending.

## Provider evidence and action-time gates

| Family | Implemented/local qualification | Hosted-qualified | Credential-gated destination and completion evidence | Live-certified |
| --- | --- | --- | --- | --- |
| LinkedIn and social publish (Instagram, Facebook, X, TikTok) | Exact publish/account/content/destination scope; SQL evidence lifecycle | No | Choose exact organization/profile/page/account and approved post visibility. Qualify authenticated post-ID readback against exact content/assets/account. Publishing or scheduling is an external side effect; no account or hard cost cap is selected here. | No |
| Gmail send | Exact send/mailbox/recipient digest; acceptance cannot complete | No | Select exact mailbox and recipient/resource identities. Qualify authenticated sent-message readback. Message identity proves send record, not inbox placement or reading. Any send needs action-time recipient authority and a verified cost cap. | No |
| HeyGen generation | Render/input/asset/account scope; budget and resource binding | No | Select account, approved avatar/voice/input/assets and hard credit/USD maximum. Verify completed job and resulting video identity. Generation/upload may consume credits and disclose assets. None authorized here. | No |
| YouTube publish | Channel/content/resource scope; completion evidence contract | No | Select exact channel/video, privacy and publication settings. Verify processing completion, video ID and visibility by authenticated readback. Upload/publication is an external side effect; no channel or cost bound is selected here. | No |
| Manual-social handoff | Manual acknowledgement receipt contract | No | Select exact operator, destination account and recipient/handoff resource. Authenticate acknowledgement of the exact handoff. This never proves publication. External handoff/send remains gated. | No |
| SMS | Schema describes parked contract; SQL refuses qualification preparation; no manifest dispatch family | No | Remains parked. Sender/account, recipient consent, suppression, registration, delivery receipts and hard cost cap all need a separate authorized lane. | No—parked |

All provider-readback receipts used in local tests are fabricated fixtures inserted by the disposable database owner. They test persistence and enforcement, not provider authenticity. No account access, credential validation, provider acceptance or actual completion was observed. No expenses incurred.

## Validation and evidence

See [validation.json](qa/phase8/validation.json), [PostgreSQL results](qa/phase8/postgres-results.txt), [Phase 7 regression results](qa/phase8/recovery-results.txt), and [campaign suite results](qa/phase8/focused-results.txt).

Tests cover every provider family contract, SMS parking, exact identity mismatches, acceptance/uncertainty, budget retention/settlement, resource drift, duplicate/conflicting/concurrent receipts, before-commit rollback and after-commit replay, expiry/revocation, approval/source/lease drift, service-role/public denial, both stop/inspection orderings, both controlled-qualification/recovery orderings, migration over a populated journal, and physical PostgreSQL restart with complete evidence comparison. The inherited Phase 7 suite is also run with this migration applied before its tests. PostgreSQL is 18.4 on a disposable loopback cluster with synthetic records; it is not hosted Supabase qualification.

The full campaign suite includes release/assembly route contracts and the campaign page tests. No UI or route behavior changed, so rendered desktop/mobile QA and a new MP4 are not applicable. No live workflow/customer-data smoke was run. The guarded production build blocks non-loopback network access and uses synthetic configuration. Full typecheck retains only existing duplicate-property errors at `lib/social-comment-inbox-ui.test.ts:51–52`, verified on `origin/main`. Changed-file lint and diff checks pass. Neither Vercel context was deployed or checked by this lane.

Commands:

```sh
CAMPAIGN_TEST_POSTGRES_MODULE=/private/tmp/campaign-phase6-postgres/node_modules/embedded-postgres/dist/index.js node scripts/qa/campaign-provider-certification-postgres.mjs
CAMPAIGN_RECOVERY_WITH_CERTIFICATION=1 CAMPAIGN_TEST_POSTGRES_MODULE=/private/tmp/campaign-phase6-postgres/node_modules/embedded-postgres/dist/index.js node scripts/qa/campaign-atomic-recovery-postgres.mjs
node_modules/.bin/vitest run lib/campaign-release-*.test.ts 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/api/admin/campaigns/[id]/releases/assemble/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx'
node_modules/.bin/eslint lib/campaign-release-provider-certification.ts lib/campaign-release-provider-certification.test.ts lib/campaign-release-activation-server.ts lib/campaign-release-dispatch.ts lib/campaign-release-atomic-recovery.test.ts scripts/qa/campaign-provider-certification-postgres.mjs scripts/qa/campaign-atomic-recovery-postgres.mjs
node --import tsx scripts/build-chatbot-knowledge.ts
node scripts/qa/campaign-release-recovery-server.cjs --build
node_modules/.bin/tsc --noEmit --incremental false
git diff --check
```

The local runners require process/shared-memory permission and use only loopback databases named `campaign_phase8_test` / `campaign_phase7_test`. They must never target hosted data. No package or credential changes are required.

## Next explicit gate and rollback

1. Captain reviews the stacked PR and security boundary after Phase 7 integration, including the copied Phase 7 recovery function with its additional qualification guard. Future Phase 7 changes must be carried into this replacement deliberately.
2. Before hosted work, pass the Captain's direct Supabase-tool and CLI readiness gate. Select an isolated provider-disconnected staging target; record project/branch ID, actual PostgreSQL version, source schemas and migration history. Apply prerequisites plus `20261004005627_campaign_provider_certification.sql` under normal staging authority. Capture before/after journal/evidence state, grants and advisors. Run synthetic qualification using actual schema serialization and distinct connections; retain resulting evidence.
3. For each provider, prepare a review packet with exact account ID, destination/resource, credential-reference UUID/version, verifier identity/version, approved content/asset digest, environment, mode, expiry, enforceable total cost limit and proposed external effect. Unknown identities or cost are blockers. Do not resolve a raw credential into documentation or chat. Obtain action-time authority before any readback/provider call, send, upload, publication or paid generation.
4. Implement and independently qualify each authenticated verifier, issuance authorization, aggregate spending control and controlled-receipt adoption before granting a runtime access to private mutation functions. A no-delivery certificate cannot stand in for controlled-delivery qualification. Keep SMS parked.
5. Only after those gates: separately review transport/worker activation, live predecessor receipt semantics, signed Slack approval/outcome integration and a supervised end-to-end campaign. This phase has not completed any of those gates.

Rollback is evidence-preserving: disconnect consumers, snapshot journal plus all qualification/receipt/certification/revocation tables, and revoke service-role inspection EXECUTE if needed. Retain the recovery guard for every possible controlled delivery. Do not restore Phase 7's weaker no-invocation proof, drop evidence, recycle delivery keys or clear reservations. Production application changes a security/recovery boundary and needs explicit current approval. No hosted migration or rollback was performed.

Completed: production-shaped durable certification boundary and local transactional qualification. Next: Captain review and isolated hosted qualification. Remaining blockers: no installed provider verifiers, no live-certified scopes, no runtime activation, and controlled-receipt adoption not implemented. The multi-channel/Slack end goal is unchanged.
