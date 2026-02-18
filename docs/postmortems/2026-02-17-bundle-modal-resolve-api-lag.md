# Postmortem: Bundle View Modal Performance Lag (2026-02-17)

## Summary

Users experienced ~8 second delay when opening the bundle view modal on `/admin/sales/bundles` (e.g. clicking "View" on "MM Digital Transformation", 24 items). Root cause was the resolve API performing 48 sequential DB queries (2 per item). The fix was to batch-fetch content and roles by `content_type`, reducing the resolve phase from ~6.5s to ~0.2s and total API time from ~7.9s to ~1.3s.

## What went well

- **Evidence-before-fix** — Debug mode and instrumentation were used; hypotheses (API total, expand, loop, fetch, client render) were tested with timestamps. Logs confirmed the loop phase (`loopMs: 6508`) and total API (`totalMs: 7875`) as the bottleneck before any code change.
- **Targeted fix** — Only the proven bottleneck was changed: the resolve route now uses `batchFetchContentAndRoles()` and an in-memory resolve loop. No speculative client-side or UX changes.
- **Verification with logs** — Post-fix run showed `loopMs: 189`, `totalMs: 1288`; instrumentation was removed only after log-based confirmation.

## What could improve (process + root cause)

- **N+1 not considered at design time** — The resolve route was implemented with a natural but expensive pattern: for each bundle item, fetch content then role (2 queries × 24 items = 48 sequential round-trips).  
  **Why:** No checklist or rule prompted “batch by parent/key when resolving a list of related entities.”  
  **Impact:** Severe UX (8s lag) for a common admin action; fix required a refactor of the resolve handler.

- **No loading state on View** — The client calls `viewBundleDetails`, then `setViewingBundle` only after the full response. Users see no feedback between click and modal.  
  **Why:** UX for slow endpoints wasn’t specified; “View” was treated as instant.  
  **Impact:** Perceived freeze; with the API now ~1.3s, less critical but a loading indicator would still improve perceived performance.

## Action items

| Priority | Action | Owner |
|----------|--------|--------|
| Low | When adding list/detail or “resolve many” APIs that fetch related rows (content, roles, etc.), consider batching by type or parent id and document in code (e.g. “Batch-fetch to avoid N+1”). | — |
| Optional | Add a loading state when “View” is clicked (e.g. spinner or “Loading bundle…”) until resolve response returns. | — |

## Proposed rule or skill update (prevent recurrence)

- **Target:** New or existing rule under `.cursor/rules/` (e.g. `api-batch-avoid-n-plus-one.mdc` or a short addition to an existing API/backend rule).
- **Change type:** New rule or add a subsection to an API rule.
- **Rationale:** Reduces the chance of introducing N+1 in new “resolve list” or detail APIs.
- **Suggested content (copy-paste-ready):**
  - When an API resolves a **list of items** and each item requires related data (e.g. content row + role row), **batch-fetch by dimension** (e.g. by `content_type` or parent id) using `.in('id', ids)` or equivalent, then resolve in memory. Avoid a loop that does one or two queries per item.
  - One-line comment in resolve-style handlers: e.g. `// Batch-fetch to avoid N+1; do not add per-item DB calls in the loop.`

## References

- Resolve route (batched fetch): `app/api/admin/sales/bundles/[id]/resolve/route.ts`
- Bundle expand (unchanged): `lib/bundle-expand.ts`
- Client view flow: `app/admin/sales/bundles/page.tsx` (`viewBundleDetails` → `ViewBundleModal`)
- Rule added: `.cursor/rules/api-batch-avoid-n-plus-one.mdc`
- Rules: evidence-before-fix, debug instrumentation cleanup, migration-rollout-checklist
