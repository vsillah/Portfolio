# Services theme and Speaking visuals QA

## Revision and route

- Product commit: `3c73bc7a3d8aa96d3e74c74c646290db250576cf` (`codex/services-theme-speaking-visuals`).
- Exact localhost catalog: `http://localhost:3037/services?type=speaking&rev=3c73bc7a3d8aa96d3e74c74c646290db250576cf`.
- Speaking detail: `http://localhost:3037/services/a278e803-9328-490b-bf57-8fbee7d129ee?rev=3c73bc7a3d8aa96d3e74c74c646290db250576cf`.
- Built from the product commit with the current public service catalog environment, local mock outbound mode, and `NODE_OPTIONS=--max-old-space-size=8192`. The localhost server was restarted from that build before the captures. The API returned 41 services and one matching Speaking Engagement.

## Evidence

- [MP4 walkthrough](services-speaking-walkthrough.mp4): 25 seconds, H.264, 1280×720, 24 fps. It is assembled from the exact-build in-app Browser screenshots below; each frame is labeled and the mobile frames show top and action regions side by side. It contains no customer data.
- Dark desktop: [catalog](desktop-dark-catalog.png), [second gallery frame](desktop-dark-speaking-qa.png).
- Light desktop: [catalog](desktop-light-catalog.png), [detail and second frame](desktop-light-detail-qa.png).
- Light tablet: [catalog](tablet-light-catalog.png), [detail](tablet-light-detail.png).
- Mobile: [light catalog](mobile-light-catalog.png), [dark catalog](mobile-dark-catalog.png), [dark detail](mobile-dark-detail.png).
- [Asset source register](source-register.md). The two gallery frames are clearly labeled illustrative concepts; they are not documentation of an actual engagement.
- Rebuild the video with `node docs/qa/services-theme-speaking-visuals/make-walkthrough.mjs`.

## Checks performed

- `./node_modules/.bin/vitest run lib/service-speaking-visuals.test.ts lib/service-gallery.test.ts components/Navigation.test.tsx` — 10 tests passed.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build` with the matching public catalog environment — passed, including `/services` and `/services/[id]`.
- `git diff --check` — passed.
- Browser widths: 1440, 820, and 390 px; catalog and Speaking detail in light and dark themes. `document.documentElement.scrollWidth` was below the viewport at each width. The visible-text contrast audit found no failures; its only low-ratio report was the intentionally hidden `.sr-only` carousel status text.
- Catalog: Speaking filter showed 1 of 41; zero-result delivery and search states exposed Clear filters; Featured showed 7 of 41. Gallery arrows and image indicators switched between two distinct loaded images. The card's cart action updated the cart count; cart navigation reached the sign-in gate without checkout. Quote service action opened the prefilled contact route without submission.
- Speaker Fit Brief: incomplete submission displayed its validation message; a completed synthetic selection linked to the Speaking service, where the brief and Revise action appeared. No organizer information was submitted.
- `ffprobe` confirmed the MP4 is H.264, 1280×720, 24 fps, with 601 frames; an extracted mobile frame was visually inspected.

`tsc --noEmit --pretty false` reported existing errors in unrelated test files and missing generated modules. The completed production build passed its type and page generation checks. No preview or production deployment, physical device run, live purchase, or customer-data workflow was performed. Vercel – portfolio and Vercel – portfolio-staging remain for Captain review.

## Consulting and workshop extension (2026-11-02)

- Product commit: `d8c11d95878beaa1b67f925d86dc5f70773615c3` on the same branch and draft PR #1177. The exact localhost catalog was `http://localhost:3037/services?rev=d8c11d95878beaa1b67f925d86dc5f70773615c3`, served from that worktree and build with the current public service catalog environment and mock outbound mode. No service record was changed.
- [Per-record audit](service-gallery-audit.json): 31 qualifying public records reviewed, one named built example retained, 30 weak galleries replaced with 60 unique photographic JPEGs. [Source register](source-register.md) and [asset inventory](asset-inventory.json) give the source, crop, hash, and illustrative claim boundary.
- [MP4 walkthrough](consulting-workshop/services-consulting-workshop-walkthrough.mp4): 28 seconds, H.264, 1280×720, 24 fps, assembled from the exact-build in-app Browser captures below. It shows catalog filters, distinct gallery frames, Management Consulting, workshop participation, tablet, and mobile states. No private customer data appears. Rebuild with `node docs/qa/services-theme-speaking-visuals/consulting-workshop/make-walkthrough.mjs`.
- [Dark workshop catalog](consulting-workshop/desktop-dark-workshops.png), [light workshop catalog](consulting-workshop/desktop-light-workshops.png), [cohort second frame](consulting-workshop/desktop-light-cohort-secondary.png), [Management hero](consulting-workshop/desktop-dark-management-hero.png), [Management second frame](consulting-workshop/desktop-dark-management-secondary.png), [Data Migration second frame](consulting-workshop/desktop-dark-data-migration-secondary.png), [tablet](consulting-workshop/tablet-light-workshops.png), [mobile gallery](consulting-workshop/mobile-dark-cohort-secondary.png), [mobile detail](consulting-workshop/mobile-dark-cohort-detail.png). The directory also contains full-page workshop and additional detail captures.

### Extension validation

- `./node_modules/.bin/vitest run lib/service-photographic-gallery.test.ts lib/service-speaking-visuals.test.ts lib/service-gallery.test.ts components/Navigation.test.tsx` — 13 tests passed.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build` with the current public catalog Supabase environment, `MOCK_N8N=true`, and `N8N_DISABLE_OUTBOUND=true` — passed, including 132 static pages. The matching `next start --port 3037` served browser QA.
- HTTP `HEAD` of all 60 inventory paths on localhost returned 200 and `image/jpeg`; `ffprobe` confirmed the extension MP4 is H.264, 1280×720, 24 fps, 672 frames. An extracted mobile frame was visually inspected.
- In-app Browser: the Workshop type filter showed 3 of 41, while a `Workshop` name search showed all five workshop/cohort offers, including records cataloged as Consulting or Training Program. Management Consulting and Data Migration second-frame arrows changed the visible scene and status from 1 of 2 to 2 of 2. Management and cohort detail links loaded the correct service. Both Request Quote actions reached `/?contact=true&service=<exact service ID>` without submission.
- Visual inspection covered dark and light desktop, 820 px tablet, and 390 px mobile catalog and detail states. The workshop images visibly contain laptops; Management Consulting reads as a private one-on-one session. The 820 and 390 px DOM scroll widths were below their viewports; no horizontal overflow or clipped card action was seen.
- The existing Speaking pair and its earlier QA evidence remain valid and unchanged. No deployment, live purchase, customer-data workflow, physical-device test, or production service write was performed. Both Vercel contexts remain unchecked by this implementation lane. PR #1133 also edits `lib/service-gallery.test.ts`; the Captain should resolve that small test-file overlap during integration.
