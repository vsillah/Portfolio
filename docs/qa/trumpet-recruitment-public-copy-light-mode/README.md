# Trumpet Trainer concept page review

Reviewed product source commit: `71e93c59` on `codex/trumpet-recruitment-public-copy-light-mode`.
Route loaded from that local production build: `http://localhost:3119/work/trumpet-trainer/recruitment?rev=71e93c59`. The page remains unlinked, noindex, and without an interest form or live call to action.

`desktop-walkthrough.mp4` (1280 × 800) and `mobile-walkthrough.mp4` (360 × 780) show the opening, gameplay, seven-screen carousel, adult personas, six-step timeline, and light-to-dark theme change. The route contains first-party product media and generated demonstration audio; no student, customer, account, or provider data was used. Both H.264/yuv420p MP4s fully decoded after capture. Headline, timeline, and Song Builder stills cover light and dark themes at 360, 768, and 1280 pixels as applicable.

Slide 7 uses `public/showcases/trumpet-trainer/a558583a/song-builder-capture.png`, a byte-for-byte copy of the corrected first-party capture at `docs/qa/trumpet-recruitment-visual-story/source/after-1062.png` (SHA-256 `4613e9d8f4785d4e922a2fe120435ae2cc131f2476cf180eb6df24741b965b5f`). Its visitor-facing words and frame are rendered in the carousel component. The historical image containing a tester-interest invitation remains in the internal source history but is not displayed on this route. Slides 1–6 are unchanged.

Focused validation: 28 Vitest tests; scoped ESLint; `git diff --check`; production `npm run build`; licensed source guard with the approved local iMeshh ZIP. Browser checks at 360, 768, and 1280 pixels in light and dark found no horizontal overflow, broken images, visible recruitment copy, or page errors. At each width and theme, all seven gallery screens, four persona cards, six timeline steps, arrows and dots, and video playback were exercised. No live workflow or customer-data smoke was run.

To reproduce the evidence from the same product source commit: start the local production build on port 3119 with outbound services disabled, then run `REVIEW_COMMIT=71e93c59 REVIEW_PORT=3119 node docs/qa/trumpet-recruitment-public-copy-light-mode/capture.mjs`. The script captures browser output and writes MP4 files and stills here. It requires Playwright Chromium and FFmpeg. It does not call a live provider.
