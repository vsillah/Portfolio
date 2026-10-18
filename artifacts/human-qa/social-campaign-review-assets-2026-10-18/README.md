# Social campaign review assets — Human QA packet

- Rendered product source commit: `f802a155`
- Required review revision: the current PR head. Resolve it immediately before starting localhost with `QA_REVISION=$(git rev-parse --short=8 HEAD)` and use that value for every `rev=` parameter below.
- Local server: `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run dev -- --hostname 127.0.0.1 --port 5318`
- Fixture binding: `qa_fixture=social_campaign_review_assets_v1`
- Side effects: none. The fixture performs no production read or write and enables no provider call, render, upload, platform draft, schedule, publish, external send, credential change, migration, or spend.

## Exact review routes

- Jev LinkedIn: `/admin/social-content/80618d32-7046-4abc-b2b7-8adb5526bb2e?step=visuals&qa_fixture=social_campaign_review_assets_v1&rev=${QA_REVISION}`
- Dark Castle LinkedIn: `/admin/social-content/9817a689-0565-48ed-8c97-c2db40c1ec45?step=visuals&qa_fixture=social_campaign_review_assets_v1&rev=${QA_REVISION}`
- AI Audit LinkedIn: `/admin/social-content/0085c317-2902-42e6-81cc-c9dc8d23028f?step=visuals&qa_fixture=social_campaign_review_assets_v1&rev=${QA_REVISION}`
- Jev YouTube: `/admin/social-content/939b01e3-d1af-42c8-805e-0379f09efd60?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=${QA_REVISION}`
- Dark Castle YouTube: `/admin/social-content/c12378f2-36de-4bf7-8c5d-0ce754e727eb?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=${QA_REVISION}`
- AI Audit YouTube: `/admin/social-content/3dad4cca-72b7-4705-8fb6-273bf7500ce6?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=${QA_REVISION}`

The immutable commit and fully expanded localhost URL used for the final verification belong in the PR handoff or captain review comment after the evidence commit is created. A tracked file cannot embed its own commit SHA without changing that SHA again.

## Review sequence

1. Confirm each LinkedIn visual is differentiated, product-grounded, and source-bound.
2. Confirm the Jev title and thumbnail teaser match the approved v5 receipt exactly.
3. Confirm the Dark Castle and AI Audit YouTube packets show `Unscored` and `0/3 qualifying descriptions`.
4. Confirm each YouTube packet keeps title and thumbnail teaser complementary and includes the hook, storyboard, proof map, conclusion, and spoken CTA.
5. Confirm the route stays read-only and all external gates remain closed.

## Captured evidence

- Desktop: 1440 × 1000
- Tablet: 820 × 1000
- Mobile: 390 × 844
- Walkthrough: H.264 MP4, 1440 × 1000, 30 fps, 29 seconds, 870 frames

The MP4 is a privacy-safe walkthrough assembled from the exact browser-captured states above. The final frames explicitly show the 0/3 description-evidence blocker at desktop and mobile widths.
