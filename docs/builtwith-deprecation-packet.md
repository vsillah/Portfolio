# BuiltWith Watch And Deprecation Packet

Date: 2026-05-01

Status: watch item. BuiltWith should remain active while Portfolio increases
outreach and client traffic. This packet is a dependency map and future
deprecation plan only; it is not approval to cancel BuiltWith or remove
production functionality. Cancellation still requires the explicit phrase
`Cancel BuiltWith for Portfolio`.

## Recommendation

Keep BuiltWith as a watched integration until more prospects and clients move
through the outreach, audit, implementation-strategy, and proposal workflows.
The current traffic level is not enough to decide whether BuiltWith improves
sales preparation, implementation strategy quality, or conversion.

If later evidence shows low usage, low conversion value, or avoidable spend, use
this packet to plan a controlled deprecation. The likely replacement path is not
another paid API by default. First preserve the existing admin-verified tech
stack workflow, reduce automatic enrichment where appropriate, and use manual or
browser-assisted research for client stack confirmation. If automated enrichment
is still useful, run a small provider bakeoff before promoting a replacement.

## Evidence

- Gmail billing evidence found BuiltWith receipts on 2026-04-10 for $99.00,
  $99.00, and $109.00.
- The BuiltWith dashboard/account check was attempted through Computer Use, but
  the site presented an image CAPTCHA before dashboard access. No account,
  cancellation, billing, or settings action was taken.
- Repo evidence confirms BuiltWith has live integration surfaces that support
  sales preparation and implementation feasibility.
- BuiltWith should remain on the watchlist until enough outreach/client volume
  exists to evaluate whether its stack enrichment materially helps the
  implementation strategy and sales flow.

## Portfolio Dependency Map

Environment and core library:

- `.env.example` declares `BUILTWITH_API_KEY`.
- `lib/tech-stack-lookup.ts` normalizes BuiltWith Domain API v22 payloads,
  extracts a lookup domain, calls `https://api.builtwith.com/v22/api.json`, and
  returns technologies plus optional `creditsRemaining`.
- `lib/constants/builtwith-tag-map.ts` maps BuiltWith tags into Portfolio's
  canonical stack categories for feasibility scoring.

Runtime/API surfaces:

- `app/api/admin/tech-stack-lookup/route.ts` exposes the admin-only lookup
  endpoint: `GET /api/admin/tech-stack-lookup?domain=example.com`.
- `app/api/tools/audit/start/route.ts` runs a non-blocking BuiltWith enrichment
  when a public standalone audit starts with a website URL, then stores
  `diagnostic_audits.enriched_tech_stack`.
- `app/api/tools/audit/context/route.ts` runs the same non-blocking enrichment
  when audit context is updated with a website URL and no existing enrichment.
- `app/api/admin/outreach/leads/[id]/route.ts` saves
  `contact_submissions.website_tech_stack`, captures
  `website_tech_stack_fetched_at`, and propagates the stack to linked
  diagnostic audits.
- `app/api/admin/contact-submissions/[id]/verified-tech-stack/route.ts` returns
  BuiltWith, audit, and admin-verified stacks, then lets admins save
  `contact_submissions.client_verified_tech_stack` as the source of truth.

Admin and scoring surfaces:

- `app/admin/outreach/page.tsx` shows the lead pipeline "Fetch tech stack"
  action, calls the admin lookup API, stores the result on the lead, and shows
  remaining credits when present.
- `app/admin/sales/[auditId]/page.tsx` displays "Website technologies
  (BuiltWith)" and the admin conflict-reconciliation UI.
- `lib/implementation-feasibility.ts` merges client stack sources with
  precedence `verified > audit > builtwith`, computes conflicts, and records
  BuiltWith credit state.
- `lib/implementation-feasibility.test.ts` verifies BuiltWith merge/conflict and
  credit-state behavior.
- `lib/tech-stack-lookup.test.ts` verifies BuiltWith payload normalization and
  domain lookup behavior.

Docs:

- `docs/admin-sales-lead-pipeline-sop.md` documents the lead-pipeline BuiltWith
  lookup, admin-verified stack reconciliation, and `BUILTWITH_API_KEY`.
- `docs/subscription-cancellation-audit.md` tracks BuiltWith as a watched
  integration after the 2026-05-01 billing evidence pass.

## Blast Radius If Removed Incorrectly

- Public audit submissions could silently lose `enriched_tech_stack`.
- Sales/admin users could lose the one-click "Fetch tech stack" lead workflow.
- Implementation strategy decks and proposals could have less automatic
  feasibility context unless admin-verified or audit-provided stack data exists.
- Existing database rows with `website_tech_stack` and `enriched_tech_stack`
  should keep rendering; the deprecation should avoid deleting historical data.
- Tests and SOP language currently assume a BuiltWith source and credit-state
  model.

## Replacement Options

Option A: keep BuiltWith and measure value during outreach.

- Keep the current integration, but restrict use to qualified sales leads or
  paid-client preparation.
- Track whether BuiltWith-informed implementation strategies improve sales
  preparation, proposal quality, or conversion.
- Add a feature flag or explicit admin-only gate before any automatic lookup.
- Best while client traffic is still ramping.

Option B: deprecate automatic lookup and use manual/admin verification.

- Stop public audit `start` and `context` routes from calling BuiltWith.
- Keep `client_verified_tech_stack` as the canonical source.
- Let admins research a stack manually or with browser-assisted review, then
  save it through the existing verified-stack UI.
- Lowest-cost path and the recommended first deprecation step.

Option C: replace with another enrichment provider after a bakeoff.

- Compare BuiltWith against Apify actors, browser-assisted research, and any
  lower-cost enrichment API using shared domains and evidence capture.
- Score accuracy, coverage, latency, cost, rate limits, data provenance, and
  operational fit.
- Only promote a replacement behind an adapter or provider interface.

Option D: cache-only fallback.

- Preserve historical `website_tech_stack`, `enriched_tech_stack`, and
  `client_verified_tech_stack` data.
- Return a clear "provider unavailable" response from the admin lookup route
  when no provider is configured.
- Feasibility assessments continue from verified/audit data and existing cached
  rows.

## Approval-Gated Implementation Plan

Only run this plan after there is enough sales/client evidence to justify
removal and Vambah gives the approval phrase `Cancel BuiltWith for Portfolio`.

1. Add a provider gate, for example `TECH_STACK_LOOKUP_PROVIDER=disabled` or
   `BUILTWITH_LOOKUP_ENABLED=false`, defaulting to disabled for automatic public
   audit enrichment.
2. Remove or gate fire-and-forget BuiltWith calls in
   `app/api/tools/audit/start/route.ts` and
   `app/api/tools/audit/context/route.ts`.
3. Keep the admin-verified tech stack route and UI so sales can preserve
   canonical client stack data without BuiltWith.
4. Update `app/api/admin/tech-stack-lookup/route.ts` to return a clear
   provider-disabled response unless a configured provider is intentionally
   enabled.
5. Update `lib/implementation-feasibility.ts` labels and tests only if the
   source name changes from `builtwith` to a generic `enrichment` source.
6. Update `.env.example`, `docs/admin-sales-lead-pipeline-sop.md`, and the
   subscription tracker to reflect the new default.
7. Cancel the BuiltWith account only after the code path is deployed or after
   Vambah confirms the downtime is acceptable.

## Validation

Run focused validation after any implementation:

```bash
npm test -- --run lib/tech-stack-lookup.test.ts lib/implementation-feasibility.test.ts
git diff --check
```

If route behavior changes, add route-level tests or manually verify:

- `GET /api/admin/tech-stack-lookup?domain=example.com`
- public audit start/context flows with and without a website URL
- admin sales page verified-stack save flow

## Rollback

- Re-enable the provider flag or restore `BUILTWITH_API_KEY` if the integration
  is still present.
- Revert the implementation commit if the deprecation removes required sales
  context.
- Historical database fields should not need rollback because the recommended
  path preserves existing `website_tech_stack`, `enriched_tech_stack`, and
  `client_verified_tech_stack` values.
