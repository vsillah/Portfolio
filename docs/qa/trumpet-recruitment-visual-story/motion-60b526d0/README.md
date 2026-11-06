# Trumpet timeline motion QA

Source UI commit: `60b526d0880cb0d1ce511e4a1c76ff4c0a4892a7` on `codex/trumpet-recruitment-visual-story`.

Local production build: `http://localhost:3018/work/trumpet-trainer/recruitment?revision=60b526d0880cb0d1ce511e4a1c76ff4c0a4892a7&qa=six-beat-motion#plan`. The route remains an internal, noindex, inactive recruitment review. Screens use synthetic or approved public material.

The MP4s are 10 fps encodes from the exact local production build. The 11-second wide recording first shows the 1279 CSS-pixel desktop page, then the 768 CSS-pixel tablet page; each segment includes an enlarged crop from its own captured frames. The 5.5-second phone recording shows the 360 CSS-pixel page and an enlarged live valve crop. The phone browser's document-crop capture moved its sticky header across the page while sampling, so the phone MP4 uses the clean final page frame as context and overlays only the valve region from captured motion frames. Frames 1-5 of beat 1 hold the first clean frame to avoid the capture artifact. This edit is confined to the QA video; the application and source asset are untouched. The phone MP4 demonstrates the valve strokes; the wide MP4 additionally shows the six card and pin responses.

Beat timing in each segment: 1 at 0.0s; 2 at ~0.5s; 3 at ~1.0s; 4 at ~1.5s; 5 at ~2.0s; 6 at ~2.6s. The tablet segment begins at 5.5s. The page runs the beats 620 ms apart. Beat 1 settles the trumpet; beat 2 presses valve 1; beat 3 presses valve 2 and dampens a vibration; beat 4 presses valves 1 and 3; beat 5 presses valves 2 and 3; beat 6 resolves at the bell. Each step card, connector, and pin follows its instrument beat.

Viewport checks from the rendered build: 360, 768, 1062, and nominal 1280 CSS pixels (actual 1279 due Chrome's existing 67% zoom). No horizontal document overflow. A step's native details control opened by pointer and closed with Enter at 768px. Scroll away and return did not replay the sequence. Reduced-motion behavior passed the component test with `matchMedia` set to `reduce`; Chrome DevTools rendered emulation was not completed in this capture session.

The instrument source remains `public/work/trumpet-trainer/design/brass-trumpet-timeline-v1.png`, SHA-256 `5f69be66bbd1957d214e823c6a679f70ff0eafe7782b9ad683d88bf9c8b955ce`; its creation prompt and selection are in the sibling provenance document.
