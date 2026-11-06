# Trumpet Trainer concept page review

Reviewed source commit: `b91dbb94` on `codex/trumpet-recruitment-public-copy-light-mode`.
Route: `/work/trumpet-trainer/recruitment?rev=b91dbb94` on a local production build. The page remains unlinked, noindex, and without an interest form or live call to action.

`desktop-walkthrough.mp4` (1280 × 800) and `mobile-walkthrough.mp4` (360 × 780) show the opening, gameplay, seven-screen carousel, adult personas, six-step timeline, and the light-to-dark theme change. The route contains illustrative media and synthetic audio; no student, customer, account, or provider data was used. The MP4 files were encoded as H.264/yuv420p and fully decoded after capture. Responsive timeline stills cover light and dark themes at 360, 768, and 1280 pixels. Headline stills cover 360 and 1280 pixels.

Focused validation: 28 Vitest tests; scoped ESLint; `git diff --check`; production `npm run build`; licensed source guard with the approved local iMeshh ZIP. Browser checks at 360, 768, and 1280 pixels in both themes found no horizontal overflow, broken images, or page errors. At each width, all seven gallery screens, four persona cards, six timeline steps, arrows and dots, and video playback were exercised. The gallery's final image preserves a historical tester-interest invitation; a visible caption says sign-ups are closed.

To reproduce the media from the same source commit: start the local production build on port 3117 with outbound services disabled, then run `REVIEW_COMMIT=b91dbb94 node docs/qa/trumpet-recruitment-public-copy-light-mode/capture.mjs`. The script captures browser output and writes MP4 files and stills here. It requires Playwright Chromium and FFmpeg. It does not call a live provider.
