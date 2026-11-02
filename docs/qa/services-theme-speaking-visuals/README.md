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
