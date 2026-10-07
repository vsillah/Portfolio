# LinkedIn video review closure

Branch: `codex/linkedin-video-review-closure`. Base: `7fc86f8d` (#1028).

The existing Social Content detail page now compares the approved campaign LinkedIn packet with its linked draft, applies an explicitly reviewed handoff, and previews attached video beside the final post text, CTA, and hashtags. Social Insight remains the upstream review; Video Generation remains the render library. No admin page or queue was added.

## Operator path

1. Open the existing Social Insight's **Open Social Content draft** link.
2. In the Copy step, choose **Compare approved campaign copy**. Review incoming copy and the linked source receipts, then **Apply reviewed copy to this draft**. Save or reload any unsaved editor changes first.
3. Complete the existing saved-copy approval. Handoff intentionally returns copy to draft review.
4. Choose **Load completed videos**, select a completed library job, then **Preview completed job**. Review the player before **Attach this video**. Older jobs can be located by ID.
5. Watch the final video in **LinkedIn Preview** alongside the full copy. Confirm content, rights, and privacy, then **Approve this media version**.
6. Native LinkedIn submission remains blocked. It requires a separately qualified Videos API upload/finalize adapter and verified author video-post permissions. This change neither requests scopes nor probes credentials.

## Persistence and conflict contract

- Canonical copy fields remain on `social_content_queue`; video URLs now store private archive references. The archive migration below is required.
- `rag_context.campaign_review_handoff` keeps the complete approved packet (including research, claim boundaries, voice/framework/editorial receipts), source identity, exact packet hash, actor/time, prior copy, and synchronized copy hash. Previous handoff receipts are retained in `campaign_review_handoff_history`.
- Linked calendar, work item, campaign, Social Content ID, channel, approval, and enrichment must agree. Client-provided packets are never accepted as authority.
- First handoff requires explicit comparison against the current target timestamp. A repeated exact packet performs no write. Later human copy edits produce a conflict and remain intact. Target writes use a timestamp compare-and-swap.
- `reviewed_video_asset` binds job ID, archive SHA-256, canonical archive reference, and poster. `media_review` binds approval to that exact tuple and re-reads the job before approval. Reattaching a different URL or job version invalidates media, asset/privacy, draft, and final submission approvals.
- Generic copy updates cannot fabricate or replace these server receipts. Changed copy invalidates media approval. Existing schedule/publish/reconciliation locks apply to all review writes.
- Asset identity uses the archived MP4 SHA-256. Signed playback expires after five minutes and is excluded from approval identity. A changed archive requires renewed media review.
- LinkedIn orchestration and the direct adapter both fail closed for attached video. Omitting `videoUrl` in an adapter payload cannot turn a canonical video item into a text/image post.

## Validation

- Direct staging and production Supabase `list_migrations` calls passed; CLI MCP servers were enabled. Database operations were read-only.
- `npx vitest run 'app/admin/social-content/[id]/page.test.tsx' lib/social-campaign-review-handoff.test.ts lib/social-copy-revision.test.ts lib/social-platform-orchestration.test.ts lib/publishing/linkedin.test.ts lib/publishing/linkedin-video.test.ts components/admin/SocialVideoReview.test.tsx 'app/api/admin/social-content/[id]/review-handoff/route.test.ts' lib/social-content-publisher.test.ts 'app/api/admin/social-content/[id]/platform-submission/route.test.ts' lib/social-sequential-release.test.ts lib/social-approval-release.test.ts lib/social-regeneration-release.test.ts`
- Changed-file `npx next lint --file …`: passed. `git diff --check`: passed.
- `npm run build:knowledge`: passed (generated local prerequisite).
- `npx tsc --noEmit --incremental false`: five existing errors in `app/admin/campaigns/[id]/page.test.tsx:228` (two null assignments), `components/admin/CampaignResearchBinding.test.tsx:13` (mock signature), and `lib/social-comment-inbox-ui.test.ts:51-52` (duplicate properties). Those lines are present on the base commit. No changed-file type errors. Full production build not claimed.

## Rendered QA and reproduction

Run in a clean worktree with dependencies installed and no real `.env` files:

```sh
npm run build:knowledge
CAMPAIGN_QA_PORT=4027 node scripts/qa/campaign-release-recovery-server.cjs
# In another terminal:
node scripts/qa/linkedin-video.cjs
```

The real Next.js route `/admin/social-content/video-review-qa?step=copy` runs at 390, 768, and 1440 pixels. The fixture executes the real new API handlers against an in-memory adapter. All external requests are intercepted; the video bytes come from an existing public repo MP4. No media generation, provider call, shared-data mutation, upload, schedule, or publish occurred.

The walkthrough exercises comparison, synchronization, repeated comparison, completed-library selection, job preview, attachment, blocked media approval before copy approval, exact-version media approval, native playback, replacement invalidation, and human-edit conflict. Zero page errors and horizontal overflow; zero external requests. Existing copy approval is a fixture precondition, not live approval evidence. Existing upstream Social Insight and Video Generation navigation links are preserved; their full workflows were not requalified.

Evidence: [results](qa/linkedin-video/results.json), [mobile MP4](qa/linkedin-video/390-walkthrough.mp4), [mid-width MP4](qa/linkedin-video/768-walkthrough.mp4), [desktop MP4](qa/linkedin-video/1440-walkthrough.mp4). Screenshots sit beside each clip. MP4 output is H.264 with native controls visible in the captured preview.

The in-app Browser was opened to the exact local route and reached the sign-in gate; synthetic-session recording used the isolated browser test harness. Authenticated deployed preview QA remains for the captain. No production campaign IDs were changed. Neither Vercel – portfolio nor Vercel – portfolio-staging deployment verification was performed in this lane. The private archive migration is required; it remains unapplied. No environment, credential, or billing change was made.

## Captain handoff

Open a draft PR and stop before merge/deployment. Review the baseline typecheck failures, qualify the authenticated preview, and perform Human QA. Native video delivery remains a separate implementation and authorization gate; this PR closes internal review only.

## Captain regression: canonical channel mismatch

Captain QA identified an Instagram canonical item whose authorized `instagram_reels` calendar handoff contains an approved LinkedIn channel packet. The panel previously checked only the canonical platform labels, and the API separately required a LinkedIn calendar channel.

The page now mounts `LinkedInReviewSurface`. Native LinkedIn items retain their existing behavior. Other platforms require a linked calendar and a successful authenticated, read-only handoff preview before the controls appear. That preview validates the exact Social Content/calendar/work-item/campaign lineage, LinkedIn packet approval, and passing enrichment. Removing the calendar-channel assumption does not remove those checks. Unrelated Instagram-only items remain excluded. Canonical platform and target platforms remain unchanged.

Regression coverage includes the reported canonical platform/target mismatch, missing or rejected linked evidence, and mismatched packet ownership. The API fixture and all three responsive recordings now use `platform=instagram`, `target_platforms=[instagram]`, and `calendar.channel=instagram_reels`, with the approved LinkedIn packet linked to that same synthetic item. The focused suite passes 211 tests. The five baseline typecheck errors remain unrelated; lint and diff checks pass. No production/shared row was changed.

## Private archive extension

Expired HeyGen inputs are blocked in the library, preview, attachment, and approval paths. Provider refresh stores only `provider_video_url`; **Recover private archive** consumes that input separately. Refreshing private playback signs storage only, with no HeyGen call. Render completion alone no longer implies usable review media.

Webhook, status refresh, and batch refresh converge on `persistVideoCompletion`. It validates HTTPS HeyGen inputs, rejects redirects, limits MP4 downloads to 100 MiB, checks the MP4 header, and writes a content-addressed object with `upsert:false`. Unique job/provider receipts and unique video/archive linkage handle concurrent callbacks. Pending receipts recover an already-uploaded object after a crash, including after provider URL expiry. Hash mismatches fail without replacement. Existing video records are adopted and human metadata is preserved. The old webhook Drive/n8n completion exports are no longer invoked; private archive completion does not imply external export authority.

`videoPlayback` verifies the archive bucket/path, ready receipt, and owning undeleted job before issuing a five-minute signed URL. Canonical references never expose provider signatures. Admin routes enforce authentication. The public gallery does not receive signed access to private videos; new records remain unpublished.

Migration: `supabase/migrations/20261007025138_private_generated_video_archives.sql`. Adds the private archive receipt table, provider-input column, unique video linkage, and a private storage bucket. RLS is enabled with service-role access only. It performs no legacy backfill. **Not applied in this lane.** Captain must verify staging migration/storage permissions and obtain the required production security-boundary approval before production application. Rollback should preserve archived objects/receipts and use an application rollback plan; no destructive rollback is supplied.

Validation: 246 focused tests across 18 files (including concurrency, crash recovery, expired URLs, host/type rejection, shared completion routes, provider/archive separation, and approval stability); changed-file lint passes. Typecheck retains the same five baseline errors and no new errors. Responsive synthetic walkthrough includes expired-media blocking at 390/768/1440 pixels, with zero external requests and page errors. Full authenticated Video Generation recovery and real storage/provider integration remain captain gates; no real download, storage upload, provider refresh, render, migration, or shared-row mutation was performed. The four existing production clips have **not** been recovered.

Captain sequence: inspect and apply staging migration; verify private access and mock/dedicated-fixture recovery; separately authorize production migration and recovery of the four existing jobs; then repeat authenticated preview QA before Human QA. Native LinkedIn submission remains blocked throughout.
