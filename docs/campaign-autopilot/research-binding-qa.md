# Campaign research evidence binding

This extends the existing Content Intelligence Research panel with a campaign handoff mode. It uses the existing version-checked packet review endpoint, including its operator review audit, followed by the existing approved-pattern linking endpoint. No new approval surface, database migration, or provider path is introduced.

## Scope and behavior

- Select multiple usable public packets and existing campaign handoffs; enter a decision note; explicitly approve and link.
- Already approved packets are reused. Only selected review-ready packets are reviewed. Rejected, archived, missing-pattern and source-distance-blocked packets are disabled.
- Campaign targets require draft-only calendar lineage. Server validation rechecks authorization, campaign, social-content row, work item, channel, and phase before linking.
- Campaign, channel, phase, planned date, and linked packet count appear on each target. The target count is derived from returned data. The supplied readiness campaign has **14 handoffs**, not 13.
- Multiple requests are deliberately sequential. This is not an atomic batch: a failed later request can leave earlier packet approvals or links saved. The UI reports completed counts and permits idempotent recovery after refresh.
- Existing Shaka social-insight linking remains available through the same panel's Evidence target selector.
- Up to 500 handoffs and 500 calendar lineage rows are loaded directly by the binding panel. A target whose calendar is outside the bounded set is blocked with a recovery message; the server always checks live lineage.

## Validation

Exact local preview route: `http://127.0.0.1:3226/admin/agents/content-intelligence?section=research`.

The real Next page was exercised with synthetic API fixtures at 390, 768 and 1440 pixels. The separate API tests exercise real route handlers. This is local preview evidence, not authenticated Vercel or production proof.

Commands:

```sh
npx vitest run lib/campaign-research-targets.test.ts components/admin/CampaignResearchBinding.test.tsx 'app/api/admin/agents/work-items/[id]/research-packets' app/admin/agents/content-intelligence/page.test.tsx 'app/api/admin/social-content/intelligence/research-packets/[id]/review/route.test.ts' app/api/admin/social-content/calendar/route.test.ts
CAMPAIGN_QA_PORT=3226 node scripts/qa/campaign-release-recovery-server.cjs
node scripts/qa/campaign-research-binding.cjs
npx tsc --noEmit --pretty false
npx next lint --file components/admin/CampaignResearchBinding.tsx --file lib/campaign-research-targets.ts --file app/admin/agents/content-intelligence/page.tsx --file 'app/api/admin/agents/work-items/[id]/research-packets/route.ts' --file app/api/admin/social-content/calendar/route.ts
git diff --check
```

73 focused tests pass. Browser QA passes all three widths with zero outbound requests and zero page errors. Captures cover selection, blocked packets/handoffs, completion with updated counts, unauthorized recovery, empty targets, human-readable planned dates, and the 500-row lineage lookup. API tests cover unrelated targets, stale lineage, authentication, approved-only behavior, idempotency, the bounded calendar limit, and all-false external side effects.

Full typecheck remains blocked by unchanged files: nullable values in `app/admin/campaigns/[id]/page.test.tsx:228`, duplicate keys in `lib/social-comment-inbox-ui.test.ts:51-52`, and the absent ignored `lib/chatbot-knowledge-content.generated` module. No changed-file type errors remain. Full production build was not run; the actual Next Research route compiled and rendered in the isolated preview.

No live workflow or customer-data smoke was run. No production reads/writes, provider jobs, uploads, publishing, scheduling, or external sends were performed. Both Vercel contexts must be checked by the captain before integration: `Vercel – portfolio` and `Vercel – portfolio-staging`.

Evidence: [desktop MP4](qa/research-binding/1440-walkthrough.mp4), [mobile MP4](qa/research-binding/390-walkthrough.mp4), [results](qa/research-binding/results.json). The same directory contains desktop/tablet/mobile screenshots and the tablet MP4.

## Captain handoff

Base: `c0a49a81` (merged #1025). Branch: `codex/campaign-research-binding`. Worktree: `/Users/vambahsillah/.codex/worktrees/ba14/Portfolio`.

Open PR #1023 owns the existing route test file; this lane uses a separate `campaign.test.ts` file to avoid overwriting that coverage. Captain review should verify preview authentication and repeat the exact Research route with approved test data. This lane stops at a draft PR; merge, production data mutation, and human QA approval remain outstanding.
