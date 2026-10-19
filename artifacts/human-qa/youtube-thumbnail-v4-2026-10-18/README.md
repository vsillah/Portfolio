# YouTube thumbnail v4 Human QA

Status: `REJECTED / SUPERSEDED`

Vambah rejected this v4 review round because the pale-cyan treatment, muted proof treatment, and weak focal separation did not meet the curated visual bar. The passing v4 global-average receipt is preserved as failure evidence; it is not Human-QA approval. v5 replaces this packet with a spatial, semantic color-polish gate.

Implementation commit: `04dad92c`

Localhost origin: `http://127.0.0.1:5319`

Exact review routes:

- Dark Castle: `/admin/social-content/c12378f2-36de-4bf7-8c5d-0ce754e727eb?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=04dad92c`
- AI Audit: `/admin/social-content/3dad4cca-72b7-4705-8fb6-273bf7500ce6?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=04dad92c`

The integrated Codex browser visibly confirmed the Dark Castle route at the exact revision-bound URL. The automated capture then loaded the same two localhost routes and fixtures at desktop and mobile widths.

## Gate results

- Both pre-generation receipts: `passed`.
- Both final-quality receipts: `passed`.
- Actual 320 x 180 teaser transcription: exact and legible for both candidates.
- Dark Castle raster: brightness `0.4980`, saturation `0.1950`, local contrast `0.2535`, edge density `0.0462`, playlist visual similarity `0.8391`.
- AI Audit raster: brightness `0.6415`, saturation `0.2454`, local contrast `0.2699`, edge density `0.0463`, playlist visual similarity `0.7726`.
- Face clearance: inspected face and overlay boxes are bound to the exact output hashes with 24 px minimum padding; no intersections.
- Playlist evidence remains taste-only, performance weight `0`, performance status `unscored`.
- Fresh topic-specific outlier evidence is current and receipt-bound.
- Provider generation occurred only for the bounded fresh HeyGen looks. Future provider calls, upload, platform draft, schedule, publish, external send, and production write remain closed.

## Evidence

- `dark-castle-desktop.png`: 1440 x 900 route screenshot.
- `dark-castle-mobile.png`: 390 x 844 route screenshot.
- `ai-audit-desktop.png`: 1440 x 900 route screenshot.
- `ai-audit-mobile.png`: 390 x 844 route screenshot.
- `youtube-thumbnail-v4-walkthrough.mp4`: playable H.264, 1280 x 720, 25 fps, 9.8 seconds.
- `youtube-thumbnail-v4-walkthrough.webm`: source recording.
- `youtube-thumbnail-v4-walkthrough-contact-sheet.png`: visual playback inspection.

All evidence uses repository fixtures and public or owned review assets. No credentials, private messages, contact details, production records, uploads, platform drafts, sends, schedules, or publishing actions are present.

The rejected v3 packet remains preserved separately and labeled `REJECTED / SUPERSEDED`; it is not approval proof.
