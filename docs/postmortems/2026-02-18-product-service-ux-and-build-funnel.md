# Postmortem: Product/Service UX Alignment & Build Funnel Page (2026-02-18)

## Summary

Two threads: (1) **Product detail UX** — Aligned the product detail page (`/store/[id]`) with the service detail pattern: Navigation, Breadcrumbs, Back to Store, single-card layout with hero, description, “What’s included” (deliverables), “Available in packages” (new `GET /api/products/[id]/bundles`), and Add to Cart. (2) **Build failure** — User saw “Cannot find module for page: /admin/analytics/funnel”. Investigation showed the funnel page exists locally and on GitHub (vsillah/Portfolio); clearing `.next` and rebuilding with network succeeded. Likely causes: stale/corrupted Next.js cache or build environment (e.g. sandbox without network) rather than a missing file.

## What went well

- **Service-as-template** — The service detail page was used as the single source of truth for layout, sections, and copy; product detail was refactored to match (hero, meta, description, deliverables, packages, price + CTA) so both content types feel consistent.
- **API parity** — New `GET /api/products/[id]/bundles` mirrors the existing services bundles API (`expandBundleItems`, filter by `content_type === 'product'`), so “Available in packages” works the same way for products and services.
- **Quick verification of “missing” page** — Grep and glob confirmed `app/admin/analytics/funnel/page.tsx` on disk; GitHub API confirmed it on `main`. That ruled out accidental delete or branch mismatch before suggesting cache/build-environment fixes.
- **Clean rebuild** — `rm -rf .next && npm run build` with network succeeded; no code change was required for the funnel route.

## What could improve

- **Build environment clarity** — The initial build (e.g. in a sandbox) failed at “Collecting page data” with a page-not-found-style error. A later build with network passed. Documenting that **full builds require network** (fonts, etc.) and that **cache issues can surface as “module not found” for a page** would help future triage.
- **Postmortem trigger** — This postmortem was requested explicitly. Consider adding a short note in the end-of-session or handoff rule: “For sessions that include debugging (e.g. build failures, flaky behavior), add a brief postmortem to `docs/postmortems/` when the root cause is non-obvious or process-related.”

## Action items

| Priority | Action | Owner |
|----------|--------|--------|
| Low | In README or a “Build & run” doc, note that `npm run build` needs network access (e.g. Google Fonts) and that “Cannot find module for page: /path” can be resolved by clearing `.next` and rebuilding. | — |
| Optional | When debugging “missing page” build errors, first confirm the route file exists and is tracked in git; then try `rm -rf .next && npm run build` with network before changing code. | — |

## References

- Product detail page: `app/store/[id]/page.tsx`
- Product bundles API: `app/api/products/[id]/bundles/route.ts`
- Service detail (reference): `app/services/[id]/page.tsx`
- Service bundles API: `app/api/services/[id]/bundles/route.ts`
- Funnel page: `app/admin/analytics/funnel/page.tsx`
- GitHub repo: vsillah/Portfolio, branch main
- Rules: post-implementation-handoff, post-implementation-testing
