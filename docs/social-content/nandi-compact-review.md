# Nandi: compact Social Content detail

Status: captain scripted QA passed at `f3ef2778`; final visual review found header contrast loss over bright media. The solid-background correction awaits a fresh rendered run. Draft PR remains gated on that check.

## Binding and scope

- Branch: `codex/nandi-social-content-compact`
- Worktree: `/Users/vambahsillah/.codex/worktrees/14c0/Portfolio`
- Dependency/base: PR #1030, `codex/campaign-video-editorial-eligibility`, commit `f85661d2028ca84565d019051691eecf4ddfdc78`.
- Classification: Dependent, explicitly authorized to stack on that commit. #1030 remains unchanged.
- The removed Nandi checkout was restored at its original path. Its clean branch was rebased onto the authorized dependency; no conflicts occurred.

## Changes

- The existing LinkedIn preview shows a 480-character excerpt, with an accessible full-copy toggle.
- Campaign/video review shows a status, count of known review blockers, and first two actionable review blockers. The external submission boundary remains visible separately. Unloaded candidate evidence is not represented as a passed gate.
- Native disclosures hold campaign copy/lineage, editorial checks and evidence, completed-video eligibility, media audit, and approval details. Disclosures retain local form state and perform no network requests by themselves.
- The existing sticky header shows the selected decision and a link that focuses its canonical section, accounts for header height, and reports an unavailable section. Its next-action disclosure preserves blocker information. The redundant loaded mobile summary and sticky preview were removed; loading/recovery summaries remain.
- Action handlers, disabled predicates, server routes, approval invalidation, and provider gates are unchanged.

## Validation

Focused regression command:

```sh
npx vitest run components/admin/AdminSidebar.test.tsx components/admin/CompactPostPreview.test.tsx components/admin/SocialVideoReview.test.tsx 'app/admin/social-content/[id]/page.test.tsx' lib/campaign-video-eligibility.test.ts lib/campaign-video-render.test.ts lib/video-editorial-provider-gate.test.ts lib/social-video-production.test.ts 'app/api/admin/social-content/[id]/review-handoff'
```

116 tests passed across 10 files. Includes full-copy restoration, disclosure-state preservation without granting editorial approval, current-decision focus, existing copy/review behavior, and eligibility/provider gates.

```sh
npx next lint --file app/admin/layout.tsx --file components/admin/CompactPostPreview.tsx --file components/admin/CompactPostPreview.test.tsx --file components/admin/SocialVideoReview.tsx --file components/admin/SocialVideoReview.test.tsx --file 'app/admin/social-content/[id]/page.tsx' --file 'app/admin/social-content/[id]/page.test.tsx'
node --import tsx scripts/build-chatbot-knowledge.ts
npx tsc --noEmit --pretty false
node --check scripts/qa/nandi-social-compact.cjs
git diff --check
```

Scoped lint, knowledge generation, QA-script syntax, and diff checks passed. Typecheck retains errors in three untouched test files: campaign detail page tests, `CampaignResearchBinding.test.tsx`, and `social-comment-inbox-ui.test.ts`. No changed-file diagnostics. Full production build was not run.

## Rendered evidence and final contrast correction

The captain ran the permitted synthetic QA in this worktree at `f3ef2778`:

```sh
CAMPAIGN_QA_PORT=4031 node scripts/qa/campaign-release-recovery-server.cjs
node scripts/qa/nandi-social-compact.cjs
```

The script exited 0 at 390, 768, and 1440 pixels. The exact route was `http://127.0.0.1:4031/admin/social-content/video-review-qa?step=copy`, using real application components and review handlers with in-memory synthetic records. Results are in `qa/nandi-compact/results.json`.

| Width | Collapsed post | Expanded post | Compact review |
| --- | --- | --- | --- |
| 390 | 468.5 px | 1901.75 px | 340 px |
| 768 | 377.5 px | 1492.25 px | 320 px |
| 1440 | 468.5 px | 1901.75 px | 340 px |

The preview reduction is about 75% on this fixture. These are component measurements, not a claimed reduction of the task's original 5,912-pixel production page.

All widths recorded zero external requests, provider calls, production mutations, and page errors. Assertions covered disclosure keyboard operation, full-copy expansion, focused decision visibility, main-container scrolling, bounded document scrolling, mobile drawer open/close/Escape, desktop sidebar, blocked legacy video attachment, media approval, script invalidation, editorial review, and old-render rejection. Mutations occurred only in the in-memory fixture. Copy approval was a fixture precondition, not exercised by this run.

Captain visual inspection passed the compact-review and sticky-decision screenshots. Nandi also inspected those screenshots and sampled frames from all three H.264 MP4s. The videos are 21.84 seconds (390), 23.08 seconds (768), and 24.88 seconds (1440), each 898 pixels high. All screenshots, the three MP4s, and results are preserved in `qa/nandi-compact/`. The stale `390-sticky-geometry.png` diagnostic was removed.

The tablet MP4 exposed an additional issue around 2 seconds: the bright playback fixture showed through the sticky header, washing out its labels. `bg-background/95` uses a CSS-variable color that does not produce the intended opaque background here. The header now uses solid `bg-gray-950` without backdrop blur, and the QA harness asserts the actual computed background color. Existing captures precede this contrast correction and must not be presented as final passing evidence for it.

This lane's Browser again refused the route because its admin-enforced policy check was unavailable. No bypass was attempted. The next step is one fresh permitted QA run from the captain's working browser session, replacing the captures/results and checking header contrast over the bright media. Once that passes, open a draft PR based on `codex/campaign-video-editorial-eligibility` (#1030), then stop before merge/deployment.

## Limits and integration

The shared admin shell is viewport-bounded with `main` as the vertical scroller. No open PR owned `app/admin/layout.tsx` when checked. Desktop sidebar height and mobile overlay/drawer stacking were preserved. Other admin routes have not received a rendered smoke sweep; captain integration should include them because this is a shared shell.

Synthetic media playback uses a test asset; it is not evidence of campaign video quality. No shared/production content mutation, provider render, upload, scheduling, publishing, or external send occurred. No live customer-data smoke or production build was run. Neither Vercel context was checked: `Vercel – portfolio` and `Vercel – portfolio-staging` remain integration checks. No migration or environment changes are required. #1030 remains unchanged.
