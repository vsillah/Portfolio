# Workshop editorial color review

- Product commit: `cb16a27b78380bc5f980b6362f1aab8b2165b06e` (base `e914ec4cdef91981dd5b45b2b43af88477da0a2e`).
- Exact localhost gallery: `http://127.0.0.1:3212/services?type=workshop&rev=cb16a27b-cache-cleared-2`. Search `workshop` with All Services selected to show all five offers.
- Detail route: `http://127.0.0.1:3212/services/457da6b5-92db-4b5b-a895-ee8571a47c8c?rev=cb16a27b-detail`.
- Data: read-only public service-catalog snapshot served by `scripts/qa/service-showcase-proxy.cjs`; no authenticated or customer-data flow was run. A dummy Supabase URL and disabled outbound n8n were used.
- Screenshots: hero and second gallery frames at 1440 × 900, 820 × 900, and 390 × 844, each in light and dark themes. Full-Day detail gallery captured at mobile and desktop widths.
- Walkthrough: `workshop-editorial-color-walkthrough-cb16a27b.mp4`, made from the exact browser screenshots using `make-walkthrough.mjs`. The encoded MP4 is 32.5 seconds and was decoded and visually checked.
- Source comparison: `contact-sheet.jpg` holds the ten active frames. Earlier navy/gold-heavy frames were superseded. The source map, hashes, audit, and casting matrix point to the ten new render sources.
- Focused validation: `npx vitest run lib/service-gallery.test.ts lib/service-photographic-gallery.test.ts lib/workshop-gallery-casting.test.ts` — 11 passed. `git diff --check` passed.
- Broader validation: `npx tsc --noEmit` remains blocked by unrelated baseline errors, including a missing `chatbot-knowledge-content.generated` module and existing type errors in campaign, social, and video tests. No changed gallery source appeared in the errors.
- Scope limits: detail bundle API and purchase/quote completion were not exercised against the read-only fixture. No live workflow, deployment, or customer-data smoke was run.
