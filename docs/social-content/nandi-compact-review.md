# Nandi: compact Social Content detail

Status: implementation checkpoint; rendered validation blocked. No draft PR or Human QA handoff yet.

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
npx vitest run components/admin/CompactPostPreview.test.tsx components/admin/SocialVideoReview.test.tsx 'app/admin/social-content/[id]/page.test.tsx' lib/campaign-video-eligibility.test.ts lib/campaign-video-render.test.ts lib/video-editorial-provider-gate.test.ts lib/social-video-production.test.ts 'app/api/admin/social-content/[id]/review-handoff'
```

110 tests passed across 9 files. Includes full-copy restoration, disclosure-state preservation without granting editorial approval, current-decision focus, existing copy/review behavior, and eligibility/provider gates.

```sh
npx next lint --file components/admin/CompactPostPreview.tsx --file components/admin/CompactPostPreview.test.tsx --file components/admin/SocialVideoReview.tsx --file components/admin/SocialVideoReview.test.tsx --file 'app/admin/social-content/[id]/page.tsx' --file 'app/admin/social-content/[id]/page.test.tsx'
node --import tsx scripts/build-chatbot-knowledge.ts
npx tsc --noEmit --pretty false
node --check scripts/qa/nandi-social-compact.cjs
git diff --check
```

Scoped lint, knowledge generation, QA-script syntax, and diff checks passed. Typecheck retains errors in three untouched test files: campaign detail page tests, `CampaignResearchBinding.test.tsx`, and `social-comment-inbox-ui.test.ts`. No changed-file diagnostics. Full production build was not run.

## Rendered QA blocker and continuation

Resume checkpoint: the synthetic setup now assigns the same long public-copy fixture to both the campaign packet and the Social Content item before qualification. It uses the unqualified fixture reset so existing handoff receipts are not accidentally treated as human copy conflicts. A local execution of this exact setup confirmed that the qualified item retains the long copy; script syntax and diff checks passed. No application gates changed. The captain reported restored browser execution, but this chat's integrated Browser still refused the route on retry with the same unavailable admin-policy check. Responsive QA and MP4 remain unverified here.

The isolated no-egress localhost server started at port 4031. Initial headless test launch was denied by the OS sandbox before a page loaded. The integrated Codex Browser was then used for the requested route and refused access twice because its admin-enforced security policy check was unavailable. No alternate browser or indirect route was used after that refusal.

Consequently, none of the desktop/tablet/mobile visual checks, pixel-height improvements, sticky overlap checks, or MP4 evidence are claimed as passed. The original 5,912-pixel measurement is task-provided context, not a measurement from this implementation.

Once the browser policy service is available, resume this same lane. The prepared synthetic QA script is unexecuted and may need correction during its first permitted run:

```sh
CAMPAIGN_QA_PORT=4031 node scripts/qa/campaign-release-recovery-server.cjs
node scripts/qa/nandi-social-compact.cjs
```

It targets the actual application route `/admin/social-content/video-review-qa?step=copy`, uses the real review handlers with in-memory synthetic records, and is designed to capture 390/768/1440-pixel evidence with the admin shell. Inspect screenshots and the resulting MP4s; verify all disclosures, keyboard paths, disabled reasons, sidebar-constrained widths, and sticky positioning. The synthetic media playback substitute is a test asset, not proof of campaign video quality. Follow with the exact captain-provided authenticated review item when available, without mutating shared data.

After rendered validation passes, open a draft PR based on `codex/campaign-video-editorial-eligibility` (or rebase/retarget after #1030 merges). Stop before merge or deployment.

No shared/production content mutations, provider calls, renders, uploads, scheduling, publishing, or external sends occurred. Neither Vercel context was checked; this is not deployment evidence.
