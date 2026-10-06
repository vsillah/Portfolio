# Campaign rolling review backlog

Date: 2026-10-06. Status: implemented for draft PR review; captain review and Human QA remain open.

## Lane and preflight

- Task ID: `01a10dea-7c32-7be1-b1b2-497daa051a4f`.
- Branch: `codex/campaign-rolling-review-backlog`.
- Worktree: `/Users/vambahsillah/.codex/worktrees/2a57/Portfolio`.
- Base: `361d57b28b0e33693dcf196e9983ef63d5c8d2f9` (merged #1020).
- Classification: **Dependent, dependency satisfied**. The captain rebased this lane after #1020. Fresh open-PR file inventory found no owner of the changed calendar/cadence surfaces or `vercel.json`.
- Related test-only PRs #1022 and #1016 remain outside this diff. No merge or manual deployment is authorized here.
- The previously queued duplicate was not identified in the visible task inventory. This task remains the implementation owner.

## Behavior

Campaign > Content Calendar now leads with an internal review action, horizon coverage, ready/blocked/to-prepare filters, pagination, recovery links, and concise cadence settings. Existing planning/authorization and release review remain available under disclosures. Release deep links open their disclosure. Copy review stays in the existing Social Insight and Social Content screens; channel links select the intended lane.

Defaults: a 14-day horizon, 10 ready items when evidence permits, weekdays at 08:00 America/New_York, primary batches capped at 5 on Monday/Wednesday/Friday, revision/gap batches capped at 3 on Tuesday/Thursday, and Sunday refresh at 17:00. Settings are persisted in `campaign_review_cadence` on the campaign's first calendar row (ordered by created_at and id); no new table or migration. An item's `review_due_at` overrides its milestone for internal review. Campaign start/end dates bound the horizon. A campaign must be active. Settings cannot be saved until a calendar exists.

The existing due-gate endpoint adds `mode=review_backlog`, returning before any Slack configuration or delivery call. Its cron entry polls every 15 minutes; arbitrary configured minute values run on the first poll after the local time. DST conversion preserves the local time. Saturday does not prepare a batch. Manual preparation targets the next review window. Sunday refresh fills the ready target; weekday batches retain their caps. Existing legacy due-gate behavior is unchanged for requests without this mode.

Preparation updates only existing authorized handoff work-item channel packets. It never creates a parallel queue, authorizes a handoff, or invents calendar slots to hit a target. It verifies canonical research approval, usable framework content, source URL, expiry when present, and campaign/calendar/phase/work/draft/channel lineage. Unsupported channels, rejected drafts, missing evidence, altered review sources, and external-enabled handoffs stay blocked with recovery links. Existing matching review drafts are reused; approved/scheduled/published work is preserved. Source changes require revision through the existing panel.

Refill dedupes work/channel and social-draft/channel references. Packet identity includes canonical evidence, insight, feedback, draft copy, and the full lineage. Daily batch markers prevent repeat preparation. Conditional updates on `updated_at`, with an explicitly advanced version, protect against concurrent refill and review writes. The prepared packet remains `in_review`. Its saved Slack notification intent uses the existing notification type and goal conventions, with delivery disabled. All external side-effect flags are false.

## Validation

49 tests pass across these seven files:

```sh
./node_modules/.bin/vitest run lib/campaign-review-cadence.test.ts lib/campaign-review-backlog.test.ts 'app/api/admin/campaigns/[id]/review-backlog/route.test.ts' app/api/cron/social-content-calendar-due-gates 'app/admin/campaigns/[id]/page.test.tsx' 'app/admin/agents/social-insights/[id]/page.test.tsx'
```

Coverage includes batch limits, Sunday refill, DST, overrides, schedule bounds, authorization/evidence rejection, missing/expired evidence, stale packet preservation, concurrent/repeated refill, existing drafts, external locks, write errors, dry runs, API authentication, and no Slack delivery. Existing campaign and insight page regressions pass.

Scoped lint passes:

```sh
./node_modules/.bin/next lint --file lib/campaign-review-cadence.ts --file lib/campaign-review-backlog.ts --file components/admin/CampaignReviewBacklog.tsx --file 'app/admin/campaigns/[id]/page.tsx' --file 'app/admin/agents/social-insights/[id]/page.tsx' --file 'app/api/admin/campaigns/[id]/review-backlog/route.ts' --file app/api/cron/social-content-calendar-due-gates/route.ts
```

`git diff --check` passes. `npm run build:knowledge` succeeds. Full `tsc --noEmit --pretty false` reports four pre-existing errors: nullable dates at `app/admin/campaigns/[id]/page.test.tsx:228` and duplicate object properties at `lib/social-comment-inbox-ui.test.ts:51-52`. These lines match the base commit and are outside this change. The full production build passes with synthetic loopback configuration and outbound workflow flags disabled; it reports only existing image/Browserslist warnings.

## Responsive evidence and reproduction

The actual Campaign page and existing Social Insight page were exercised at 390, 768, and 1440 pixels, including the desktop admin sidebar. Screenshots and H.264 MP4s are in `docs/campaign-autopilot/qa/rolling-review/`. `results.json` records zero external browser requests and zero page errors at every width. The QA harness suppresses the existing Speed Insights script before insertion; all other nonlocal requests are counted and blocked. It uses synthetic in-memory persistence behind the real review API handler. This proves UI and handler behavior, not live database authorization or production persistence.

Exact recorded route: `http://127.0.0.1:4021/admin/campaigns/campaign-review-qa?tab=content-calendar`. The synthetic campaign exists only inside the harness. Real campaign routes use `/admin/campaigns/<id>?tab=content-calendar`.

Run from this worktree:

```sh
NEXT_TELEMETRY_DISABLED=1 MOCK_N8N=true N8N_DISABLE_OUTBOUND=true NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3999 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-qa SUPABASE_SERVICE_ROLE_KEY=synthetic-qa ./node_modules/.bin/next dev --hostname 127.0.0.1 --port 4021
```

In a second terminal:

```sh
node scripts/qa/campaign-review-backlog.cjs
```

The harness checks count filters, pagination, cleared filters, empty ready state, provenance disclosure, blocked evidence recovery, preparation, exhausted-batch disabled state, retry dedupe, existing copy review, settings save, and persisted settings after reload. MP4s show those routes with synthetic data. Review the recordings before live Human QA; do not infer that the fixture URL is an authenticated live campaign.

## Remaining gates and limitations

- Captain must review the draft PR, assess the existing standalone typecheck errors, and run live or staging persistence validation before integration.
- No live database workflow or customer-data smoke was run. No migrations, credentials, billing, security/privacy boundary changes, provider calls, publishes, uploads, or Slack/SMS/Gmail sends occurred.
- No deployed Vercel context was checked in this development lane. The captain's initial message reported both contexts green for base #1020; that is not verification of this branch.
- Existing metadata storage avoids a migration, but cross-table evidence/authorization reads are optimistic snapshots rather than a single database transaction. Current projection rechecks canonical sources; final approval stays in existing human review surfaces. No external execution is added.
- Scans fail closed above 500 calendar records or 50 active campaigns. A failed campaign stops that cron pass; previously prepared records remain idempotent for retry.
- The cron configuration is code only until normal captain integration/deployment. Keep this task open through captain review and Human QA.
- No expenses incurred.
