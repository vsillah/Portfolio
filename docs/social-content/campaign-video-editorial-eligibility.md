# Campaign video eligibility and editorial review

Base: `141eedcc54b5ce9d3388786ba77f0d1cd151ff4c` (merged PR #1029).
Branch: `codex/campaign-video-editorial-eligibility`.
Worktree: `/Users/vambahsillah/.codex/worktrees/d2b9/Portfolio`.

Previously, a completed job with a playable private archive could be attached to a campaign even when it came from unrelated material. Attachment and media approval now require a current campaign/work-item/Social Content binding, the approved channel, exact narration and asset packet, current avatar/voice defaults, a production-quality review, and a verified archive version. Missing evidence fails closed. Legacy archives remain playable as history.

The existing Social Content “Campaign and video review” panel now supports reviewing and editing the saved spoken script. Saving narration resets editorial and media approval. The review explicitly covers narrative coherence, spoken language, audience value, Vambah voice, self-reference, internal notes, supported claims, and campaign alignment. It requires an authenticated reviewer, all criteria, and written evidence. Deterministic screening rejects recognizable requirements, field lists, checklist syntax, production directions, and leaked internal text. Passing that screen means “needs review”; it is never an automated production-quality approval.

## Receipt and render contract

- `rag_context.campaign_video_editorial` records the human production-quality challenger review, avatar/voice, exact input version, criteria, evidence, reviewer, and time.
- `rag_context.campaign_video_bindings[job_id]` is written only after a gated new render, binding the job to the campaign, work item, content item, channel, script/assets version, and editorial receipt. There is no legacy-job adoption action.
- `reviewed_video_asset` additionally binds the editorial input/review to the archive's SHA-256 version. Media approval checks the current job and archive again.
- Generic copy updates cannot forge editorial or render receipts. Script/asset edits invalidate editorial and media approval, including an edit followed by a reversion.
- The server rereads the approved campaign packet before attachment, editorial decisions, and media approval. A stale packet, changed human copy, missing source, or changed avatar defaults blocks the action.
- The existing direct Video Generation endpoint accepts `socialContentId` with campaign render requests, requires the existing render-approval scope, and verifies exact approved inputs. It writes the campaign binding only after a successful job insert. Template overrides are blocked for campaign renders because their effective content/character is not qualified by this receipt.
- Campaign retries must return through the linked review gate. Cached script scorecards are recomputed at execution. Provider-level deterministic screening also covers other `createVideo` entry points.
- The inherited handoff contract is the approved LinkedIn lane, including a linked LinkedIn packet on an Instagram canonical item. Other channel renders cannot reuse that receipt. No provider-generation UI or external release permission was added.

Current default avatar/voice changes require a fresh review. Existing jobs receive no grandfathered approval. A new editorial review does not make an old render eligible; a new bound render is required. If a render succeeds but persistence loses a version conflict, the job remains ineligible and the error calls for reconciliation rather than an automatic retry.

## Local validation

205 unique focused and regression tests passed across 17 files (204-test regression run plus a targeted three-test render rerun adding the persistence-conflict case). Coverage includes eligible, legacy/unlinked, stale-script, wrong-channel, failed-editorial, changed-asset, wrong-avatar, wrong-campaign/work-item, changed archive version, live packet revocation, forged receipts, and asset edit/reversion. Provider-screening tests verify that checklist rejection happens before any provider request. Scoped lint and `git diff --check` pass.

Full `npx tsc --noEmit --pretty false` remains blocked by errors in three unchanged files: `app/admin/campaigns/[id]/page.test.tsx`, `components/admin/CampaignResearchBinding.test.tsx`, and `lib/social-comment-inbox-ui.test.ts`. No changed-file errors were reported. A full production build was not run; the real Social Content route compiled and rendered in the isolated Next.js runtime.

Exact test list and logs: [tests](qa/campaign-video-eligibility/tests.txt), [lint](qa/campaign-video-eligibility/lint.txt), [typecheck](qa/campaign-video-eligibility/typecheck.txt), [browser results](qa/campaign-video-eligibility/results.json).

The browser harness exercises the real Social Content page and real review handlers against an in-memory database adapter. At 390, 768, and 1440 pixels it demonstrates legacy playback with disabled attachment, eligible attachment, explicit media review, script edits invalidating approval, checklist rejection, a fresh editorial decision, and the old render remaining ineligible. It asserts no horizontal overflow, page errors, or external requests. The displayed video is an existing public synthetic illustration, not the real campaign asset.

Reproduce in this clean worktree without real environment files:

```sh
node --import tsx scripts/build-chatbot-knowledge.ts
CAMPAIGN_QA_PORT=4028 node scripts/qa/campaign-release-recovery-server.cjs
# Separate terminal:
node scripts/qa/campaign-video-eligibility.cjs
```

Exact route under the harness: `http://127.0.0.1:4028/admin/social-content/video-review-qa?step=copy`. Fixture interception is required; the URL alone is not an authenticated production QA session.

[Mobile walkthrough](qa/campaign-video-eligibility/390-walkthrough.mp4) · [Tablet walkthrough](qa/campaign-video-eligibility/768-walkthrough.mp4) · [Desktop walkthrough](qa/campaign-video-eligibility/1440-walkthrough.mp4).

## Captain handoff

No database migration, credential change, live provider call, production mutation, actual asset attachment/upload, scheduling, publishing, or external send occurred. No campaign script or legacy archive was approved in production. The real campaign still needs editorial review and a separately authorized new render after integration.

Both Vercel contexts remain unverified in this development lane: `Vercel – portfolio` and `Vercel – portfolio-staging`. Merge, deployment verification, and live Human QA belong to the captain. Keep this lane open through Human QA. This draft PR supplies local behavior evidence; it does not certify the real campaign's editorial quality, real avatar output, or production readiness.
