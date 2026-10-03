# Campaign autopilot: release review foundation

Status: development foundation; live campaign execution blocked. This package does not complete Campaign Autopilot Closure.

The campaign Content Calendar tab now reviews immutable Broadcast Release and Relationship Outreach Batch packets. A SHA-256 hash binds exact copy, assets and asset hashes, accounts, audience/recipient, schedule, spending caps, consent/suppression evidence references, expiration, stop conditions, dependencies, and expected receipts. One recipient is allowed per relationship action; one batch may contain many actions. SMS is rejected by the schema.

## What this change implements

- `lib/campaign-release-manifest.ts`: strict schemas, stable hashes, bounded decisions, terminal stop, deterministic action keys.
- `lib/campaign-release-store.ts`: existing `agent_runs` records with kind `campaign_release_manifest`; insert-only manifest identity, source fingerprint checks at preparation/approval, compare-and-swap decisions and an audit history in the same atomic update. No migration.
- `POST /api/admin/campaigns/[id]/releases`: admin-only preparation from a fully assembled manifest. The campaign and source rows must exist. Source fingerprints use `campaignSourceFingerprint` on the current server row. The response includes a Slack card but does not post it.
- `GET` lists the latest 30 release records or loads the exact `?release=` target; `PATCH` records an exact version decision. The existing campaign Content Calendar tab displays the records. A `?release=<UUID>` link opens that tab.
- Signed, allowlisted, source-bound Slack interactions accept Approve release, Request revision, Hold, and Emergency stop. Open in Portfolio links to the campaign. Existing durable Slack receipt processing handles accepted callbacks. No Slack notification is sent by manifest preparation.
- `lib/campaign-release-coordinator.ts`: adapter/store contract and synthetic qualification for duplicate claims, scheduling, dependencies, uncertainty, partial outcomes, receipt identity and stop checks. No production adapter or execution store is registered. No cron or provider route calls this coordinator.

An approval in this package records intent for the exact packet. It does not replace the existing `agent_approvals`, social final-submission gate, Gmail recipient gate, privacy review, consent certification, or provider authority. A later execution integration must consume all applicable controls and recheck authority at the provider's durable claim boundary. Existing independent publishing/send routes are unchanged; this release's stop does not claim to stop unrelated workflows.

## Operator path

1. Open Campaigns, select the campaign, then Content Calendar.
2. Complete copy/media/channel review on the existing Social Content, warm outreach, and Video Generation surfaces.
3. The campaign owner assembles the exact manifest using the source rows and the schema. Submit it to the admin preparation endpoint using the existing authenticated Portfolio client. Preparation UI and automatic assembly are still outstanding.
4. Review Campaign releases. Expand Review content and scope, then inspect each action's copy, account, recipient, assets, schedule and cap. Open channel review for the underlying work.
5. Approve release records only this packet. Hold or Request revision requires a fresh packet. Emergency stop permanently stops this record; completed external actions cannot be recalled.
6. If a decision is unconfirmed, use Refresh releases and inspect Decision history before retrying. An expired or changed packet requires a new release ID and a new approval.

Do not post a generated Slack card, enable a provider, send, publish, schedule externally, or render paid media as part of this foundation QA.

## Production truth snapshot

Read-only checks performed 2026-10-03 UTC. No raw credentials, recipients, messages, provider IDs, or private assets were exported. Repository base: `bada9bf1902e397d484e2aa1c9e1b949ccc09d62`.

| System | Classification | Evidence and remaining gate |
| --- | --- | --- |
| Portfolio | Built; deployed baseline | Existing campaign/calendar, Social Content, warm outreach, video and Agent Ops routes. New release code is not yet deployed. |
| Supabase | Configured; live read verified | Direct production MCP schema and aggregate queries succeeded. Expected tables exist. No schema/data mutation performed. CLI lists enabled servers, HTTP auth state reports Unknown; direct query supplies actual access evidence. |
| Vercel | Production baseline checks passed | Both `Vercel – portfolio` and `Vercel – portfolio-staging` statuses success on base commit. This is not new-branch deployment proof. |
| Slack | Built; campaign canary blocked | Signature/actor/channel/source checks and durable receipt worker exist. Production query returned zero `slack_action_receipt` and zero `campaign_release_manifest` runs. New campaign card was not posted/clicked live. |
| n8n | Configured; health verified; execution paths blocked | Cloud health OK; 85 workflow metadata entries read. Production `WF-SOC-002: Social Content Publish`, social image/audio regeneration, and `WF-CLG-003: Send and Follow-Up` inactive. Staging names include active workflows; their names do not establish safe production targets. No workflow invoked or changed. |
| LinkedIn | Built; configuration record present; historical receipt evidence | Active configuration; four published rows with provider IDs. Current token/account scope and exact-manifest canary unverified. |
| Gmail | Built; historical message evidence; campaign canary blocked | Non-test outreach includes one replied email with a message ID, plus drafts/rejected rows. This does not independently prove a current direct Gmail send or fresh token validity. |
| HeyGen | Built; historical completed-job evidence | Four non-deleted completed jobs with HeyGen IDs and asset URLs. New render/spend-cap enforcement and final-asset review still require qualification. |
| YouTube | Built; configuration record present; historical receipt evidence | Active configuration; one published row with provider ID. Current OAuth/channel and exact-asset canary unverified. |
| Instagram | Built; configuration record present; historical receipt evidence | Active configuration; four published rows with provider IDs. Current permissions/canary unverified. |
| Facebook | Built; configuration record present; historical receipt evidence | Active configuration; one published row with provider ID, three skipped. Current permissions/canary unverified. |
| X | Built; configuration record present; historical receipt evidence | Active configuration; four published rows with provider IDs. Current access tier/account/canary unverified. |
| TikTok | Built; blocked | Inactive configuration and no credential record. No publishing receipt observed. |
| Telnyx SMS | Built readiness scaffolding; parked | Consent and suppression readiness code exists. One approved SMS queue row has no message ID. Brand/campaign/sender certification and current consent are not proven. Schema excludes SMS. |
| Archived HeyGen cold-email workflow | Obsolete for this path | n8n metadata reports archived and inactive. Do not reactivate as the campaign executor. |

Stored published/completed statuses and credential presence are historical evidence, not provider-side revalidation or proof of the new end-to-end campaign transaction. No path is labeled campaign production-proven.

## Remaining closure gates

1. Automatic packet assembly from canonical campaign/calendar, social final review, warm per-recipient review, HeyGen script/privacy/budget review, and final YouTube asset/metadata. A future generated asset cannot be silently substituted for a hash approved before it existed: render first, review the output, then prepare a fresh publishing manifest.
2. Durable action execution storage with globally unique claims and transactional/fenced authority checks. The current coordinator tests use an in-memory synthetic store; they do not qualify production concurrency.
3. Certified adapters that preserve social final-submission and Gmail recipient-specific authority; current account, consent, suppression, source and hard budget checks must repeat immediately before provider dispatch. Provider calls remain absent from this foundation.
4. Execution integration with existing calendar scheduler, receipt reconciliation and recovery surfaces. A provider timeout must retain its claim. Recovery may attach a verified receipt; it must not blindly resend. Manual-social receipts must stay distinct from provider publication proof.
5. A bounded Slack dispatch/click canary and callback receipt/card-update evidence. No new card dispatch authority was used here.
6. A separately authorized LinkedIn/Gmail/HeyGen/YouTube pilot, followed by channel expansion and five consecutive supervised campaigns with no duplicates and complete receipts. Keep SMS excluded until certification.

## Ownership assessment

A dedicated Campaign Orchestrator responsibility is justified: it should assemble manifests, verify dependencies, watch receipts, and propose recovery. It should have no independent authority to approve, change recipients, lift budgets, bypass suppression, or activate providers.

For this phase, Amina (Zazzau), the existing Strategic Narrative owner, owns packet preparation; Yaa Asantewaa owns automation transport; Nzinga owns decision trace/reconciliation; Shaka coordinates exceptions. Preserve their stable technical keys. A dedicated culturally grounded display identity can be selected when an actual runtime and accountable execution contract are ready. No agent registry entry or runtime was activated in this PR.

## Validation and review evidence

- Focused manifest, coordinator, Slack card, API authorization, existing Slack action/block/receipt tests: 169 passed after safety reconciliation.
- Existing campaign detail tests: 4 passed with no React act warnings. Release-list fetches are mocked explicitly and each tab-opening test waits for the panel load.
- Changed-file ESLint and `git diff --check`: passed.
- Full TypeScript check: after generating local chatbot knowledge, blocked only by baseline duplicate properties at `lib/social-comment-inbox-ui.test.ts:51-52`; new files have no reported type errors. Production build not run while the baseline typecheck is failing.
- Real localhost campaign route, synthetic API fixtures, outbound blocked: 390, 768, 1440 px. Tested expanded scope, approval, revision, hold, permanent stop, expired approval, unavailable/recovery state and empty-state guidance. All tests passed, including expired evidence and its recovery guidance; screenshots visually inspected. Provider execution and live customer data were not tested.
- `scripts/qa/campaign-release.cjs` reproduces the walkthrough using `scripts/qa/slack-receipt-status-server.cjs` for an isolated server. Videos and result JSON are in `qa/`.

The Integration Captain owns review, merge, migrations, deployment verification and human-QA handoff. Keep this lane open; Campaign Autopilot Closure remains unfinished.

## Safety contract reconciliation (2026-10-03)

The authoritative #1001 implementation retains its UUID, source-fingerprint, dependency, API, Slack, and existing-surface model. The following stricter semantics are integrated from the foundation review:

- Parsing owns and deeply freezes every nested manifest value. Exact text is preserved rather than silently trimmed; unknown fields are rejected. Adapters receive the immutable snapshot used for the hash check.
- Every action requires `evidenceExpiresAt`, later than its schedule. Approval rejects expired evidence; execution checks expiration before and after preflight and after claim. The review panel explains expired/missing evidence and directs the operator back to channel review for a fresh packet. Earlier unreleased development packets without this field must be rebuilt and approved again.
- `campaignActionKeys` returns a revision-bound `authorizationKey`, content hash, and stable `deliveryKey`. The existing `actionIdempotencyKey` name remains a compatibility alias for delivery identity. Delivery identity remains stable across release IDs, action UUIDs, source versions, and revised copy; a reused source cannot silently deliver again.
- Confirmed receipts must match the exact copy/assets hash, provider, account, stable delivery key, and receipt type. An older-copy receipt cannot prove a revised action or unblock its dependents. Claimed, uncertain, or mismatched records require reconciliation and retain their delivery identity.
- Preflight requires explicit provider certification, current consent/suppression, and safe integer reserved spending. Reservation plus the action maximum must fit the release cap. Atomic claim now receives the exact authorization, evidence window, action maximum and release cap; implementations must reserve budget and check stop/authority atomically. The coordinator repeats authority after claim. A stop/expiry there retains the reservation for reconciliation and skips provider dispatch.
- SMS/Telnyx remains schema-rejected. No certified provider adapters or durable execution/budget store exist yet. Synthetic checks qualify these contracts only; they do not establish distributed enforcement, live receipts, or current provider authority.

Reproduction from the authoritative worktree:

```sh
node_modules/.bin/vitest run lib/campaign-release-manifest.test.ts lib/campaign-release-coordinator.test.ts lib/campaign-release-slack.test.ts 'app/api/admin/campaigns/[id]/releases/route.test.ts' lib/agent-slack-actions.test.ts lib/agent-slack-blocks.test.ts lib/slack-action-receipts.test.ts 'app/admin/campaigns/[id]/page.test.tsx'
node_modules/.bin/eslint lib/campaign-release-{manifest,coordinator,store,test-fixture}.ts lib/campaign-release-{manifest,coordinator}.test.ts components/admin/CampaignReleaseReview.tsx
git diff --check
node_modules/.bin/tsc --noEmit --incremental false
node scripts/qa/slack-receipt-status-server.cjs
node scripts/qa/campaign-release.cjs
```

The QA server must use this worktree and its isolated, synthetic environment. Reuse the already running server only after verifying its cwd and launcher. The QA script blocks browser egress and mocks APIs on the actual route; production data, signed live Slack callbacks, provider dispatch and deployment are intentionally untested. Full typecheck still reports the existing duplicate fields at `lib/social-comment-inbox-ui.test.ts:51-52`; build remains blocked and was not run. No merge, production mutation or #1000 closure was performed.

## Pre-human-QA polish

The full focused command above passes all 173 tests without warnings. Hashes display an eight-character prefix and six-character suffix; native summary titles retain the exact hash, and keyboard-accessible details reveal selectable full values. Responsive QA opens and closes both hash disclosures and checks the exact values. Evidence recovery copy is reduced to the next action.

At 390px the synthetic campaign summary title, status/type chips, description, and dates fit inside their card. `qa/390-campaign-summary.png` records the surrounding surface. The adjacent tab row clips later tabs at its right edge: this is pre-existing. The header/tab markup is unchanged from `origin/main` (only the release import, initial tab selection, and release-panel insertion differ), and the shared `.admin-console-card` overflow styling in `app/globals.css` is unchanged. Earlier walkthrough frames also scrolled the summary beneath the fixed app header; that viewport occlusion is not truncation of the summary content. This narrow pass leaves the existing tab-navigation issue for a separate UI change.

Changed-file lint for this polish: `node_modules/.bin/eslint components/admin/CampaignReleaseReview.tsx 'app/admin/campaigns/[id]/page.test.tsx'`; `git diff --check` passes. The actual route and all affected actions were rechecked at 390/768/1440; mobile and desktop MP4s were regenerated. The prior baseline type/build limitation remains unchanged; this pass does not claim deployment or live provider validation.
