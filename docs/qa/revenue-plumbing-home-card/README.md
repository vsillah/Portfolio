# Revenue Plumbing homepage card QA

This packet covers the compact homepage discovery card and the interactive Revenue Plumbing Map, including their revised light-mode contrast treatments.

## Review path

1. Open the homepage.
2. Scroll past the System Story.
3. Find the `Revenue Plumbing Map` card.
4. Confirm the card describes an interactive AmaduTown operating model for finding where revenue systems leak capacity.
5. In light mode, confirm the muted blue-gray card, bronze accents, navy action, and surrounding section transition read as one intentional surface rather than a stark white panel.
6. Select `Explore the map` and confirm the browser opens `/insights/revenue-plumbing-map`.
7. Confirm the map uses a pale blue-gray canvas, dark ink labels, distinct stage chips, bronze pipework, and a light explanation console in light mode.
8. Confirm the map remains readable and horizontally contained at mobile, tablet, and desktop widths.

## Evidence

- `homepage-card-mobile-390.png`: narrow mobile layout at 390 x 844.
- `homepage-card-tablet-768.png`: tablet and content-lane layout at 768 x 900.
- `homepage-card-desktop-1440.png`: desktop layout at 1440 x 900.
- `map-light-mobile-390.png`: light-mode map and controls at 390 x 844.
- `map-light-tablet-768.png`: light-mode map and controls at 768 x 900.
- `map-light-desktop-1440.png`: light-mode map and controls at 1440 x 900.
- `map-dark-desktop-1440.png`: dark-mode regression check at 1440 x 900.
- `homepage-card-walkthrough.mp4`: privacy-safe desktop walkthrough from the homepage card to the live map route.
- `manifest.json`: route, viewport, layout, destination, and external-request results.

The automated walkthrough blocks all non-origin requests and fulfills homepage API reads with empty synthetic responses. The hosted run reported zero completed external requests. It blocked the Vercel preview feedback-toolbar script before egress and records that attempted URL separately in the manifest.
