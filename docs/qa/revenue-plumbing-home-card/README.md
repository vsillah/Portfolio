# Revenue Plumbing homepage card QA

This packet covers the compact homepage discovery card for the Revenue Plumbing Map.

## Review path

1. Open the homepage.
2. Scroll past the System Story.
3. Find the `Revenue Plumbing Map` card.
4. Confirm the card describes an interactive AmaduTown operating model for finding where revenue systems leak capacity.
5. Select `Explore the map` and confirm the browser opens `/insights/revenue-plumbing-map`.

## Evidence

- `homepage-card-mobile-390.png`: narrow mobile layout at 390 x 844.
- `homepage-card-tablet-768.png`: tablet and content-lane layout at 768 x 900.
- `homepage-card-desktop-1440.png`: desktop layout at 1440 x 900.
- `homepage-card-walkthrough.mp4`: privacy-safe desktop walkthrough from the homepage card to the live map route.
- `manifest.json`: route, viewport, layout, destination, and external-request results.

The automated walkthrough blocks all non-origin requests and fulfills homepage API reads with empty synthetic responses. The recorded run reported zero external requests. The first packet was captured from the local production build; rerun `scripts/record-revenue-plumbing-home-card-qa.mjs` with `QA_BASE_URL` set to the PR preview URL to refresh it against the hosted review route.
