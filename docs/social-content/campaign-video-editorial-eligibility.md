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

Exact route under the harness: `http://127.0.0.1:4028/admin/social-content/video-review-qa?step=copy`. Fixture interception is required; the URL alone is not an authenticated production QA session. The local screenshots remain deterministic regression evidence only. The original fixture walkthrough MP4s are not Human QA evidence because their playable media came from an unrelated public homepage asset.

## Authenticated staging QA

The replacement Human QA evidence uses the authenticated PR-preview Social Content route and a real staging record. It demonstrates the fail-closed state without substituting unrelated media:

- the saved spoken script is `Production quality: blocked`;
- the item has no linked campaign calendar review;
- stage-direction language must be rewritten as audience-facing speech;
- every completed legacy video is labeled `Ineligible · history only`;
- the selected legacy render lists campaign, channel, script/assets, avatar/voice, archive, and challenger-review blockers;
- `Attach this video · reset media approval` remains disabled.

The capture performed only authenticated GET requests and local select/scroll interactions. It did not approve copy or editorial quality, attach media, render, upload, schedule, publish, call a provider, or mutate staging/production data.

Exact preview route: `https://portfolio-staging-git-codex-campaign-v-f9f896-vsillahs-projects.vercel.app/admin/social-content/317a251e-af97-476d-94c2-bac993c1333d?returnTo=%2Fadmin%2Fsocial-content&deploy=45be5cc4&step=copy`.

[Mobile staging walkthrough](qa/campaign-video-eligibility/staging/390-staging-walkthrough.mp4) · [Tablet staging walkthrough](qa/campaign-video-eligibility/staging/768-staging-walkthrough.mp4) · [Desktop staging walkthrough](qa/campaign-video-eligibility/staging/1440-staging-walkthrough.mp4) · [read-only receipt](qa/campaign-video-eligibility/staging/results.json).

Reproduce with a temporary auth state for the same preview origin:

```sh
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" PLAYWRIGHT_AUTH_STATE=/tmp/pr1030-preview-auth.json npm run admin:auth:save
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" PLAYWRIGHT_AUTH_STATE=/tmp/pr1030-preview-auth.json \
  CAMPAIGN_VIDEO_QA_ITEM_ID=317a251e-af97-476d-94c2-bac993c1333d \
  CAMPAIGN_VIDEO_QA_COMMIT=45be5cc4 \
  ./node_modules/.bin/tsx scripts/qa/record-campaign-video-preview-readonly.cjs
```

## Captain handoff

No database migration, credential change, live provider call, staging/production mutation, actual asset attachment/upload, scheduling, publishing, or external send occurred. No campaign script or legacy archive was approved. The current staging item correctly remains blocked until it has a linked approved campaign packet, audience-ready script, current challenger review, matching avatar/voice and asset receipts, and a verified private archive.

Deployment checks, merge, and production verification remain captain gates. Keep this lane open through Human QA. The authenticated staging evidence verifies that the preview fails closed; it does not certify any real campaign's editorial quality, avatar output, or production readiness.

## Captain re-review fixes

Canonical campaign identity now comes from `campaign_review_handoff.packet.shared_source.campaign_id`, with the older top-level field supported when no handoff exists. Incomplete or conflicting handoffs fail closed. The same resolved identity controls qualification, avatar selection, job target identity, job reuse suppression, and binding persistence. A campaign with missing editorial approval cannot fall back to a rotating avatar.

Both render entry points resolve explicit and environment-default template and brand-voice settings before campaign qualification. Campaign templates and brand voices remain unqualified and are rejected. The resulting immutable snapshot is passed to `createVideo`; that layer consumes it without a second environment fallback. The snapshot test uses mocked fetch only, including a change to the environment between qualification and dispatch.

Focused validation: **59 tests across 11 files passed**, including the actual synchronized handoff shape without a top-level campaign ID, canonical binding persistence, both routes' explicit/environment template and brand-voice rejection, and no-provider-call assertions. Scoped lint and `git diff --check` pass. No rendered UI changed; existing responsive screenshots and MP4s remain applicable.

Exact test command:

```sh
npx vitest run 'app/api/admin/social-content/[id]/prepare-avatar-video' app/api/admin/video-generation/generate/campaign-gates.test.ts lib/campaign-video-render.test.ts lib/campaign-video-eligibility.test.ts lib/video-render-inputs.test.ts lib/video-editorial-provider-gate.test.ts 'app/api/admin/social-content/[id]/review-handoff' lib/social-video-production.test.ts lib/video-script-intelligence.test.ts
```

Exact lint command:

```sh
npx next lint --file lib/video-render-inputs.ts --file lib/video-render-inputs.test.ts --file lib/heygen.ts --file lib/campaign-video-render.ts --file lib/campaign-video-render.test.ts --file lib/campaign-video-eligibility.ts --file lib/campaign-video-eligibility.test.ts --file 'app/api/admin/social-content/[id]/prepare-avatar-video/route.ts' --file 'app/api/admin/social-content/[id]/prepare-avatar-video/campaign-gates.test.ts' --file app/api/admin/video-generation/generate/route.ts --file app/api/admin/video-generation/generate/campaign-gates.test.ts
```

[Focused results](qa/campaign-video-eligibility/captain-fixes-tests.txt), [lint](qa/campaign-video-eligibility/captain-fixes-lint.txt), and [typecheck](qa/campaign-video-eligibility/captain-fixes-typecheck.txt). `npx tsc --noEmit --pretty false` reports the same errors in the three unchanged test files listed above; no changed-file errors. PR remains draft; captain re-review is required. No live provider, production mutation, attachment, upload, publication, or scheduling action was taken.
