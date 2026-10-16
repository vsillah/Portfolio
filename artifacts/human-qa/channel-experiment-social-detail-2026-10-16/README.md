# Channel-native campaign review Human QA

This packet reviews the six read-only YouTube experiment records on the Social Content detail route. The application build is bound to commit `695b1a5394d8d9b4068180b2e6a4732d4abc25fb`.

## Exact localhost routes

- `http://127.0.0.1:3107/admin/social-content/licenses-yt-a?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=695b1a5394d8d9b4068180b2e6a4732d4abc25fb`
- `http://127.0.0.1:3107/admin/social-content/licenses-yt-b?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=695b1a5394d8d9b4068180b2e6a4732d4abc25fb`
- `http://127.0.0.1:3107/admin/social-content/pm-os-yt-a?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=695b1a5394d8d9b4068180b2e6a4732d4abc25fb`
- `http://127.0.0.1:3107/admin/social-content/pm-os-yt-b?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=695b1a5394d8d9b4068180b2e6a4732d4abc25fb`
- `http://127.0.0.1:3107/admin/social-content/harness-yt-a?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=695b1a5394d8d9b4068180b2e6a4732d4abc25fb`
- `http://127.0.0.1:3107/admin/social-content/harness-yt-b?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=695b1a5394d8d9b4068180b2e6a4732d4abc25fb`

## Review evidence

- `channel-experiment-social-detail-walkthrough.mp4` contains the desktop and narrow-width walkthrough.
- The 24 PNG files cover each route at `1440x900` and `390x844`, with an initial route view and a scrolled review view.
- `qa-receipt.json` records route coverage, assertions, viewport coverage, the MP4 probe, SHA-256, and network/side-effect receipts.

The review verifies title, description, opening hook, episode outline, thumbnail brief, evidence lineage, product-proof requirements, and the explicit `Unscored` state. It also verifies that the specialized route exposes no LinkedIn preview guidance, generic copy approval gate, save action, provider call, render, upload, platform draft, schedule, publish, or external send.

## Validation

- `npm test -- --run lib/channel-experiment-review.test.ts lib/social-channel-experiment-qa-fixture.test.ts components/admin/ChannelExperimentReview.test.tsx components/admin/ChannelExperimentSocialReview.test.tsx 'app/api/admin/social-content/[id]/route.test.ts' 'app/admin/social-content/[id]/page.test.tsx` — 136 tests passed.
- Scoped `next lint` — no warnings or errors.
- `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed; only existing unrelated image and browser-data warnings were reported.
- `QA_BASE_URL=http://127.0.0.1:3107 QA_REVISION=695b1a5394d8d9b4068180b2e6a4732d4abc25fb node scripts/qa/record-channel-experiment-social-detail.mjs` — 12 route/viewport reviews passed with zero unexpected external requests.

No production Social Content row was read or mutated. This is synthetic, privacy-safe, review-only evidence.
