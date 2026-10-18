# YouTube thumbnail receipt route — Human QA packet

- Reviewed source commit: `84c788b9`
- Localhost route: `http://127.0.0.1:5319/admin/social-content/3dad4cca-72b7-4705-8fb6-273bf7500ce6?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=84c788b9`
- Viewports: desktop `1440×1000`; mobile `390×844`
- Fixture mode: repository-bound, read-only, with `MOCK_N8N=true` and `N8N_DISABLE_OUTBOUND=true`
- External effects: none. No provider generation, upload, platform draft, schedule, publish, external send, production write, migration, credential change, or spend.

## Review value

The existing Social Content review now shows the complete, version-bound route from live comparable evidence to the selected thumbnail composition. It exposes included and excluded comparisons, normalized scores, the unchanged `>=75` outlier threshold, title-thumbnail relationship, first-party product proof, receipt versions, and the user-curated playlist's zero-weight taste-calibration contribution. YouTube description evidence remains `Unscored 0/3`, so final video generation stays blocked.

## Evidence

- `desktop-1440.png`: exact read-only route and protected workflow context.
- `desktop-1440-decision-route.png`: full-width receipt identity, threshold, composition, and live comparison decisions.
- `desktop-1440-preference-boundary.png`: unchanged `Unscored 0/3` description gate, product proof, conclusion, CTA, and closed external gates.
- `mobile-390-top.png`: mobile protected-workflow context.
- `mobile-390-decision-route.png`: mobile receipt-backed status, candidate, cohort, threshold, composition, and versions.
- `mobile-390-preference.png`: mobile playlist taste boundary plus a live comparison example.
- `youtube-thumbnail-receipt-route-walkthrough.mp4`: privacy-safe H.264 walkthrough assembled from the exact browser-captured states above; 25 seconds, 1440×1000, 30 fps, 750 frames.
- `walkthrough-contact-sheet.jpg`: visual verification of the MP4 sequence.

## Validation

```text
npx vitest run lib/social-campaign-review-assets.test.ts components/admin/SocialCampaignReviewPacket.test.tsx lib/youtube-packaging-evidence.test.ts lib/artifact-evidence-manifest.test.ts
53 tests passed

npx vitest run components/admin/SocialCampaignReviewPacket.test.tsx lib/social-campaign-review-assets.test.ts lib/youtube-packaging-evidence.test.ts app/admin/social-content/[id]/page.test.tsx
131 tests passed

REUSE_DISCOVERY=1 OBSERVED_AT=2026-10-18T17:30:00.000Z node scripts/research/capture-social-campaign-youtube-thumbnail-cohorts.mjs
node scripts/qa/build-social-campaign-youtube-thumbnails.mjs
Both receipt-backed thumbnail selections regenerated with unchanged image hashes.
```

`npm run build` reached a successful Next.js compile and then stopped during repository-wide type validation because the reused local dependency tree does not contain the pinned `remotion` package. A direct `npx tsc --noEmit` also reports pre-existing unrelated test typing failures in campaigns, CampaignResearchBinding, Jev social-video completeness, social-comment inbox, practitioner content, and video-media archive, plus the same missing Remotion types.
