# Blocked YouTube review thumbnails — Human QA packet

- Rendered product source commit: `b1eb6e3d`
- Required review revision: current PR head. Resolve it immediately before localhost with `QA_REVISION=$(git rev-parse --short=8 HEAD)` and use that value for `rev=` below.
- Local server: `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run dev -- --hostname 127.0.0.1 --port 5318`
- Fixture: `qa_fixture=social_campaign_review_assets_v1`
- Side effects: none. The fixture performs no production write and enables no provider call, paid render, upload, platform draft, schedule, publish, external send, migration, credential change, or spend.

## Exact review routes

- Dark Castle Chess: `/admin/social-content/c12378f2-36de-4bf7-8c5d-0ce754e727eb?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=${QA_REVISION}`
- AI Audit Calculator: `/admin/social-content/3dad4cca-72b7-4705-8fb6-273bf7500ce6?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=${QA_REVISION}`

The immutable final commit and expanded localhost URLs belong in the PR handoff after this evidence commit exists. A tracked file cannot embed its own commit SHA without changing that SHA again.

## Review sequence

1. Confirm the Dark Castle thumbnail reads `REMEMBER THE WHY` and uses the real gameplay board.
2. Confirm the AI Audit thumbnail reads `WHO OWNS THE CLEANUP?` and uses the real calculator result screen.
3. Confirm each teaser differs from its video title.
4. Confirm the SHA-256 thumbnail receipt and original product-proof receipt are visible.
5. Confirm both records still show `Description evidence: Unscored`, `0/3 qualifying descriptions`, and `Final video blocked`.
6. Confirm every external execution gate remains closed.

## Captured evidence

- Desktop: 1440 × 1000
- Mobile: 390 × 844
- Walkthrough: H.264 MP4, 1440 × 1000, 30 fps, 22 seconds, 660 frames

The MP4 is assembled from the exact privacy-safe browser states above. It shows both thumbnails, both description blockers, and both responsive mobile layouts.
