# Phase 5: dispatch intent and sandbox certification

Status: development handoff; live dispatch remains disabled. Base `3067b9ff13c6e729e2c7703f7b37981770a73ebb` includes #1003, #1006, #1007 and #1008. Branch: `codex/campaign-dispatch-fence`. Worktree: `/Users/vambahsillah/.codex/worktrees/7d31/Portfolio`.

## Enforced boundary

The current canonical repository reads `agent_runs` and source rows through separate requests. The existing `campaign_execution_commit` RPC compares and swaps only the journal. It cannot lock the canonical decision or those sources. A second canonical read cannot close the interval between that read, journal commit and provider invocation.

This phase implements the requested fail-closed fallback. `storedCampaignDispatchFence` supplies server-owned canonical readers to `CampaignDispatchFence`; it has no route, cron, worker registration, transport argument or activation flag. `prepare` persists a dispatch intent inside the existing attempt in `campaign_execution_journal`. No second approval store, journal, table or migration is introduced.

The journal transaction checks and records:

- Canonical release ID, manifest hash, approval version and replayed audit digest against the bound journal snapshot.
- Current-source validation before the transaction and a digest of every approved action/planning-source fingerprint. This records checked evidence; it does not lock source rows.
- Expected journal CAS version, globally unique delivery key, action authorization key and exact content hash.
- Owner, attempt version and lease, plus a budget reservation checked against all committed spend/reservations for the release.
- Exact predecessor receipt identities and their digest, scheduled time, authorization/evidence windows and approved stop state.

`dispatch` rechecks canonical authority and sources, then atomically checks the journal version, owner/lease fence, keys, dependencies and budget before persisting a refusal. Its only return is `dispatched: false`. Even when every check passes, the reason is `Cross-store atomic authority unavailable. Provider dispatch disabled.` A stale source/decision produces a refusal; lost ownership, CAS conflict, invalid state or an uncertain commit throws without returning a permit. Reservations and delivery ownership remain persisted. There is no automatic release, resend or retry for these intents.

The ordinary journal `submit` and `retry` methods reject a persisted canonical intent even if its approval binding is accidentally absent. Existing bound-release claim/decision blocks remain. An intent cannot become a synthetic submission through the legacy worker methods. Recovery can transfer expired ownership but cannot enable delivery.

**Residual race:** a canonical decision or source can change after its last read and before the intent/refusal commit. The intent can therefore contain stale approval evidence. This cannot produce provider delivery because dispatch refuses unconditionally. The phase does **not** provide usable atomic live dispatch authorization. A future implementation must coordinate canonical decisions, source changes and journal claims at a common authority boundary, and define the provider handoff's irreversible linearization point. Removing the unconditional refusal before that work would reopen the race.

The existing unrelated social/Gmail/video execution routes are unchanged. This campaign stop does not claim authority over those independent workflows.

## Certification harness

`campaignCertificationContracts` defines disabled operation contracts for LinkedIn and other social publication, Gmail send, HeyGen generation, YouTube publication, manual-social handoff and parked SMS. `certifiedSandboxCallback` generates deterministic fixture evidence and uses the existing process-owned verifier and journal reconciliation. It accepts no network transport, endpoint or credentials. These tests certify sandbox semantics only.

| Operation | Completion evidence required for future live certification |
| --- | --- |
| LinkedIn/social publish | Read-back post ID, exact account/content and publication visibility |
| Gmail send | Sent message ID, mailbox, exact recipients/content; no inbox-placement claim |
| HeyGen generation | Completed job/video ID, account and approved input/asset identity |
| YouTube publish | Video ID/channel, completed processing and approved visibility |
| Manual-social handoff | Authenticated acknowledgment of the exact handoff; no publication claim |
| SMS | Parked, schema-excluded; separate sender/consent/suppression/receipt qualification |

Request acceptance never completes a step. Acceptance and uncertainty retain the reservation and block dependencies. Confirmation completes only the matching sandbox attempt; rejection/no-delivery permits existing bounded synthetic recovery. Exact callback replay is a no-op, conflicting replay fails, and reconstructed journal/verifier instances preserve spending and receipt identity. No current contract treats acceptance as delivery.

## Operator evidence

The existing Campaign releases readiness row reports the dispatch boundary. Its recovery disclosure shows `Dispatch intent reserved` or `Dispatch refused` and directs the captain to qualify atomic authority. Internal owners, audit hashes, callback data and fence tokens are excluded from the projection. Live API responses still have no journal connection; no live DB-to-UI integration is claimed.

Exact route: `http://127.0.0.1:3198/admin/campaigns/11111111-1111-4111-8111-000000000002?release=11111111-1111-4111-8111-000000000001`.

The in-app Browser reached this route but, without fixture interception, correctly showed no synthetic campaign. The isolated Playwright harness supplies synthetic API responses on that same rendered route and blocks browser egress; the server has synthetic credentials and an HTTP egress guard. This is development QA, not authenticated staging/production QA.

Passed at 390, 768 and 1440px: approval, refresh, intent/refusal states, acceptance, confirmation, uncertainty, rejection/recovery, hold, revision, stop, disabled reapproval, unavailable/recovery state, readiness and receipt disclosures, content/metadata/hash/audit disclosures and the step evidence link. No new interactive action was added. Result JSON records zero delivered external requests and zero page errors. Screenshots and extracted final-video frames were visually inspected. The pre-existing neighboring mobile tab clipping remains outside this change.

- [390px H.264 MP4](qa/phase5/campaign-recovery-390.mp4)
- [768px H.264 MP4](qa/phase5/campaign-recovery-768.mp4)
- [1440px H.264 MP4](qa/phase5/campaign-recovery-1440.mp4)
- [390px result](qa/phase5/results-390.json), [768px result](qa/phase5/results-768.json), [1440px result](qa/phase5/results-1440.json)

## Reproduction and validation

From the Phase 5 worktree:

```sh
node_modules/.bin/vitest run lib/campaign-release-*.test.ts 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/api/admin/campaigns/[id]/releases/assemble/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx'
node_modules/.bin/eslint lib/campaign-release-dispatch.ts lib/campaign-release-dispatch.test.ts lib/campaign-release-certification.ts lib/campaign-release-certification.test.ts lib/campaign-release-execution.ts lib/campaign-release-activation-server.ts lib/campaign-release-recovery-view.ts scripts/qa/campaign-release-recovery-fixture.ts scripts/qa/campaign-release-recovery.cjs
node --import tsx scripts/build-chatbot-knowledge.ts
node_modules/.bin/tsc --noEmit --incremental false
node --import tsx scripts/qa/campaign-release-recovery-fixture.ts
node scripts/qa/campaign-release-recovery-server.cjs
# Separate terminal, then stop the dev server before building:
node scripts/qa/campaign-release-recovery.cjs
node scripts/qa/campaign-release-recovery-server.cjs --build
git diff --check
```

171 relevant tests pass across 14 files, including 27 dispatch-intent and 15 operation-certification tests. Changed-file lint and whitespace checks pass. Full typecheck reports only the baseline duplicate properties at `lib/social-comment-inbox-ui.test.ts:51–52`, verified from `origin/main`; generated chatbot knowledge must be built first. The guarded production build passed with exit 0, including compilation, application type validation and static generation. Baseline image warnings and expected missing-provider configuration warnings remain. Branch Vercel checks are recorded in the PR handoff.

No live workflow/customer-data smoke, database RPC, migration application, provider request, Slack/Gmail/SMS send, publication, schedule, credential/env/flag change or paid usage occurred. Optional intent fields preserve the existing schema-v1 JSON journal. Older workers must stay disconnected; they do not understand the new intent marker.

## Remaining roadmap

Next: captain review of the fail-closed protocol and the authority-boundary design. Then qualify an atomic canonical/source/journal protocol in an authorized staging test, certify each live provider's authentication/account/receipt/no-delivery semantics, and separately authorize activation. Reservations from refused intents need an explicit audited recovery policy before live use.

One-response Slack command-center closure remains blocked by live dispatch authority, provider qualification, scheduler/recovery integration, signed live Slack callback/card-update evidence and supervised end-to-end campaign runs. This phase makes no live-execution or campaign-closure claim. Keep the development lane open for captain and human review; stop before merge.
