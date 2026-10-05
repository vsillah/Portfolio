# Campaign pattern recovery — development handoff

Base: `53a1ff0b`. Branch: `codex/campaign-pattern-recovery`.
Worktree: `/Users/vambahsillah/.codex/worktrees/bcaa/Portfolio`.
Lane classification: Independent. Open-PR file inventory found no overlap with the scoped files; PR #1020 remains separate. Recent Social Insight changes are included in the base.

## Behavior

On Social Insight, **Find approved patterns** loads the existing research-packet API. The operator can inspect an approved usable framework, link it explicitly, and then prepare channel review drafts. Empty and failed evidence loads have a review link or retry. The Content Intelligence link opens its Research section.

The new `mode: link_approved` only accepts packets with approved status, usable-framework status, source URL, and pattern content. It does not update packet approval. Existing Content Intelligence approval-and-link requests retain their current behavior for ordinary social topic triggers.

Calendar handoffs always use approved-only linking. The route verifies that the calendar row is authorized, points to this handoff work item, and agrees on campaign and social-draft IDs. It derives the missing insight from the calendar title and planned angle. Campaign, calendar, social-draft, work-item, phase, and channel provenance survive in every generated packet's shared source. IDs are not inserted into public copy.

The existing deterministic draft builder supplies review copy; it does not call a model or media provider. Seven channel packets stay `in_review`, with all five external side-effect flags false. The seed in Social Content is not overwritten or approved. The review copy is in the existing Social Insight channel panels; downstream copy adoption remains a separate workflow.

## Changed surfaces

- `app/admin/agents/social-insights/[id]/page.tsx` and its tests.
- `app/api/admin/agents/work-items/[id]/research-packets/route.ts` and its tests.
- `app/api/admin/agents/work-items/[id]/social-channels/prepare-review-drafts/route.ts` and its tests.
- `scripts/qa/campaign-pattern-recovery.cjs` and this QA packet.

## Validation

44 focused tests passed across the three affected suites and existing intelligence/calendar-handoff suites:

```sh
node_modules/.bin/vitest run 'app/api/admin/agents/work-items/[id]/research-packets/route.test.ts' 'app/api/admin/agents/work-items/[id]/social-channels/prepare-review-drafts/route.test.ts' 'app/admin/agents/social-insights/[id]/page.test.tsx' lib/social-content-intelligence.test.ts lib/social-content-calendar-handoff.test.ts
node_modules/.bin/next lint --file 'app/admin/agents/social-insights/[id]/page.tsx' --file 'app/api/admin/agents/work-items/[id]/research-packets/route.ts' --file 'app/api/admin/agents/work-items/[id]/social-channels/prepare-review-drafts/route.ts'
node_modules/.bin/tsc --noEmit --pretty false
git diff --check
```

Focused lint and diff checks passed. Repository-wide typecheck fails on existing missing `chatbot-knowledge-content.generated` imports and duplicate keys in `lib/social-comment-inbox-ui.test.ts` (also present on base). No errors reference changed files. Full production build was not run; the real Next route compiled and rendered during browser testing.

## Browser and MP4 evidence

```sh
CAMPAIGN_QA_PORT=3218 node scripts/qa/campaign-release-recovery-server.cjs
node scripts/qa/campaign-pattern-recovery.cjs
```

Exact preview route: `http://127.0.0.1:3218/admin/agents/social-insights/78060cc6-9f1c-4679-873f-4b651257a8d4`.

The real Next page and real linking/preparation handlers were exercised with synthetic browser authentication and an in-memory database adapter. The separate instrumented recording browser is needed to provide those mocks without touching production. A normal browser visit to this local server requires its own session and does not inherit the fixture.

At 390, 768, and 1440 pixels: blocked prepare control; no eligible evidence; refresh; inspect/select framework; link; prepare; review LinkedIn copy. All widths have no document overflow, no page errors, no external requests, two internal POST actions, and seven review packets with preserved provenance. Screenshots and MP4 frames were visually inspected. The real calendar authorization function remains covered by its existing ten unit tests; live authorization was intentionally not invoked.

- `390-walkthrough.mp4`: narrow-mobile flow.
- `768-walkthrough.mp4`: mid-width flow.
- `1440-walkthrough.mp4`: desktop flow with sidebar.
- `results.json`: route, request, provenance, and viewport evidence.

No live workflow/customer-data smoke, provider calls, database mutation, migrations, uploads, publishing, scheduling, Slack, SMS, or Gmail actions occurred. The IDs in the route match the reported scenario; all rendered content and state are synthetic. No claim of live recovery is made.

## Next gate

Captain review and an authorized non-production persistence check, then human QA. This lane stops at a draft PR. No merge or deployment was initiated by the lane; both Vercel contexts still require captain verification. No migration or environment change is needed.
