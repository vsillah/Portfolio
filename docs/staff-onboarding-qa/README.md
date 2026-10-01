# Staff onboarding review packet

Scope: one reusable client-safe staff guide under the existing Help surface. No database, provider, credential, billing, or permission changes.

- Branch: `codex/staff-onboarding-guide`
- Base: `bada9bf1`
- Worktree: `/Users/vambahsillah/.codex/worktrees/69d2/Portfolio`
- Exact local preview: `http://127.0.0.1:3217/help/staff`
- Section deep link: `http://127.0.0.1:3217/help/staff#first-week`
- Print route: `http://127.0.0.1:3217/help/staff/print`
- Stable path after integration: `/help/staff` on the approved Portfolio deployment. No production URL is claimed live by this lane.

## Operator walkthrough

1. From `/help`, select “Joining the team? Start with the staff guide”. The same guide is linked from authenticated `/admin/help`.
2. Read the short welcome. Select “Start your first week”; the checklist expands and scrolls into view.
3. Mark a practice task, then unmark it. Marks are temporary, not stored or sent.
4. Expand each of the six sections. Review the business map, fictional workday, approval boundaries, role checklists, tool map, and recovery/glossary.
5. Reload `/help/staff#tool-map`; the linked section opens automatically.
6. Select “Print / Save as PDF”. All sections are visible at `/help/staff/print`. Use the browser print dialog to save locally. Return with “Interactive guide”.
7. The operator-procedures link still requires admin access. Unauthenticated navigation reaches `/auth/login?redirect=%2Fadmin%2Fhelp`.

## Validation

- `npx --no-install vitest run components/help/StaffGuide.test.tsx` — 7 tests pass: collapsed start, section deep links/reload behavior, repeat anchor activation, complete print view, print expansion/restoration, checklist/capability boundaries, both Help entry points.
- `npx --no-install eslint components/help/*.tsx components/help/staff-guide-content.ts app/help/staff/page.tsx app/help/staff/print/page.tsx app/help/page.tsx app/admin/help/page.tsx` — pass, no warnings in scoped files.
- `npm run build` with local placeholder Supabase configuration and `N8N_DISABLE_OUTBOUND=true MOCK_N8N=true` — final production compile, typecheck, and full build passed. Existing unrelated image-lint and unconfigured-provider warnings remain; no live services were used.
- `git diff --check` — pass.
- `node scripts/qa/staff-onboarding.cjs` — final local production build rendered at 360, 390, 430, 768, and 1440 pixels; expanded sections, no horizontal overflow, check/uncheck, deep-link reload, Help entry, print/back actions, and unauthenticated operator access gate pass. No page errors. Results in `results.json`.
- Initial and repaired previews were checked with `agent-browser`; the exact guide and first-week interaction were also inspected in the Codex in-app Browser.
- Light and dark screenshots visually reviewed; all requested widths represented. No new chips or pills are introduced.
- PDF exported by Chromium from the real print route, rendered with Poppler, visually inspected, and checked with `pdfinfo`: 8 A4 pages, approximately 371 KB. Print-only background removal avoids decorative texture bloat; no clipped glossary or orphan checklist page.
- `node scripts/qa/staff-onboarding-walkthrough.cjs` — separate native browser recordings converted with FFmpeg to H.264/yuv420p MP4 with faststart. Mobile is 390×844; desktop is 1440×1000. Frames and metadata inspected.

## Evidence

- [Desktop walkthrough](staff-guide-desktop.mp4)
- [Mobile walkthrough](staff-guide-mobile.mp4)
- [Printable guide](staff-guide.pdf)
- Welcome screenshots: `welcome-360.png`, `welcome-390.png`, `welcome-430.png`, `welcome-768.png`, `welcome-1440.png`.
- Expanded examples: `business-map-1440.png`, `workday-360.png`, `boundaries-390.png`, `checklist-430.png`, `tool-map-768.png`.
- Theme checks: `welcome-dark-1440.png`, `welcome-dark-390.png`; print check: `print-preview.png`.

## Boundaries and remaining review

The QA server uses localhost-only placeholder credentials, with outbound n8n disabled. Browser tests block non-local requests (the existing layout attempted Vercel telemetry; it was blocked). No live workflow, customer-data, provider, send, payment, or account smoke was performed. No schema changes, migrations, new environment variables, or deployment gates are introduced. This lane did not merge or manually deploy. Vercel – portfolio and Vercel – portfolio-staging remain Captain checks.

The page is intentionally client-safe and readable without login, with noindex metadata. Noindex is not security. It contains orientation only; it grants no staff permissions. The existing site root auth and navigation behavior is unchanged.

Vambah should confirm the assigned supervisor/support channel and staff role/access scope. The first-week plan is supervised practice, not an HR policy. Capability evolution is explicitly not a dated company history. Live provider activation and entitlements remain unverified. See [source and claim register](../staff-onboarding-source-map.md).

Keep the development task open through Integration Captain review and Human QA.
