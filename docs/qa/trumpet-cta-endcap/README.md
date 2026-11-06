# Trumpet Trainer CTA endcap review

Product source commit: `e141b0cf41dc533c9610132a20de8d1179023b0f` on `codex/trumpet-cta-endcap`.
Exact local production route: `http://localhost:3124/work/trumpet-trainer/recruitment?rev=e141b0cf41dc533c9610132a20de8d1179023b0f`.

`desktop-endcap.mp4` (1280 × 600) and `mobile-endcap.mp4` (360 × 650) show the CTA endcap in light and dark, including keyboard focus on its links. Both H.264/yuv420p videos fully decoded. `endcap-{360,768,1280}-{light,dark}.png` records the rendered endcap at each reviewed width and theme. These captures use only public page content.

The primary CTA opens `https://trumpet-trainer-zeta.vercel.app/` in a new tab. A live read-only visit returned HTTP 200, title `Trumpet Trainer`, and a public first-note entry. Keyboard Enter opened that destination. Keyboard Enter on the secondary CTA navigated to `/work/trumpet-trainer` in the same tab. The concept route remains unlinked and `noindex, nofollow`, with no form or live recruitment path.

Validation: 32 focused Vitest tests across the page, carousel, personas, and timeline; scoped ESLint; production `npm run build` with `NODE_OPTIONS=--max-old-space-size=8192` and outbound services disabled; `git diff --check`; rendered Playwright checks at 360, 768, and 1280 pixels in light and dark with no horizontal overflow or page errors. Repository-wide `npx tsc --noEmit` still reports 20 errors outside `app/work/trumpet-trainer/recruitment/`, mostly in unrelated tests; Next.js production build type checking passed. No provider mutation, telemetry, customer-data smoke, billing, or auth flow was run.

Reproduce the media after starting the matching production build on port 3124: `REVIEW_COMMIT=e141b0cf41dc533c9610132a20de8d1179023b0f REVIEW_PORT=3124 node docs/qa/trumpet-cta-endcap/capture.mjs`. Playwright Chromium and FFmpeg are required.
