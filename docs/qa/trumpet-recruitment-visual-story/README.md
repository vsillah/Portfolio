# Trumpet recruitment fan clearance review

UI commit: `77a8a660e163c0d36b2d89c5897360177f40eeb3`. Exact production-build localhost route: `http://localhost:3018/work/trumpet-trainer/recruitment?revision=77a8a660e163c0d36b2d89c5897360177f40eeb3&qa=fan-clearance`.

The 17 PNG frames were captured in the Codex in-app browser from that build with placeholder public Supabase values and outbound n8n disabled. The orange `DEV ENVIRONMENT` strip identifies the local build. Frames 04–07 and 08–11 show each of the four selected personas at desktop and tablet widths. Frames 12–17 show the phone's single-card path, forward and reverse swipes, all four named choices, and expanded community contact path. Frames 01–03 show surrounding page context. The ordered frames form a stitched walkthrough of actual browser states; it is not continuous screen recording. No customer, child, recipient, or private reply data appears.

`geometry-audit.json` records each card's measured bounding box at every selected state. At 1280 and 768 px, all four card boxes stayed at least 46 px inside the page horizontally and 40 px inside the 760 px stage vertically. Document `scrollWidth` equaled `clientWidth`. The active card image and the rotated cards' corners and shadows were visually inspected in the screenshots. At 360 px, one card was visible, it stayed at least 16 px inside the page, and the expanded contact path stayed inside the card. Left and right swipes changed selection in the expected direction.

The geometry-only source change increases desktop/tablet fan stage clearance, lowers the cards, and draws the rear cards closer to the center. The fan rotation, scale, card dimensions, copy, controls, persona art, and mobile single-card behavior are retained. The route remains inactive, unlinked, and noindex.

`build-walkthrough.sh` assembles the frames into `trumpet-recruitment-fan-clearance-77a8a660.mp4`. The output is H.264 at 1280 × 850, 24 fps. Its final duration, frame count, full decode, and inspected video frames are recorded in the PR handoff.

Validation:

- `npx vitest run app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentPersonas.test.tsx components/TrumpetRecruitmentSocialCarousel.test.tsx components/TrumpetRecruitmentMessages.test.tsx components/TrumpetRecruitmentCopy.test.tsx` — 15 passed.
- Scoped ESLint and `git diff --check` — passed.
- `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed in isolation; existing unrelated lint warnings remain.

No send, schedule, provider call, data write, merge, or production deployment occurred. `capture-manifest.json` records hashes and resolves the QA commit with `git log -1 --format=%H -- docs/qa/trumpet-recruitment-visual-story`.
