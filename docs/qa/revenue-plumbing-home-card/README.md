# Revenue Plumbing homepage card QA

This packet covers the compact homepage discovery card for the Revenue Plumbing Map, including the revised light-mode contrast treatment.

## Review path

1. Open the homepage.
2. Scroll past the System Story.
3. Find the `Revenue Plumbing Map` card.
4. Confirm the card describes an interactive AmaduTown operating model for finding where revenue systems leak capacity.
5. In light mode, confirm the muted blue-gray card, bronze accents, navy action, and surrounding section transition read as one intentional surface rather than a stark white panel.
6. Select `Explore the map` and confirm the browser opens `/insights/revenue-plumbing-map`.

## Evidence

- `homepage-card-mobile-390.png`: narrow mobile layout at 390 x 844.
- `homepage-card-tablet-768.png`: tablet and content-lane layout at 768 x 900.
- `homepage-card-desktop-1440.png`: desktop layout at 1440 x 900.
- `homepage-card-walkthrough.mp4`: privacy-safe desktop walkthrough from the homepage card to the live map route.
- `manifest.json`: route, viewport, layout, destination, and external-request results.

The automated walkthrough blocks all non-origin requests and fulfills homepage API reads with empty synthetic responses. The hosted run reported zero completed external requests. It blocked the Vercel preview feedback-toolbar script before egress and records that attempted URL separately in the manifest.
