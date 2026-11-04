# Accelerated L01 Learning plan walkthrough

`walkthrough.mp4` records the localhost Learning plan from source commit `7617b02dc67a496cd49c4e5f589e0ca758a5420a` at `/service-prototypes/accelerated-cohort?view=3&rev=7617b02dc67a496cd49c4e5f589e0ca758a5420a`.

The clip shows the sixteen-lesson entry, L01 native playback with visible English captions, the approved 04:08.20–04:15.00 evidence-card boundary, read-along text, return to the plan, and locked L02/L16 video states. It uses the public/synthetic learner preview and blocks external requests during capture. `record.mjs` reproduces the capture with `REVISION=<source commit> PLAYWRIGHT_BASE_URL=http://localhost:3105 node docs/qa/accelerated-l01-approved-binding/record.mjs`.

The MP4 is H.264, 1280×800 at 25 fps, 13.52 seconds. It was decoded with FFmpeg and checked at playback, evidence-card, transcript, and locked-state frames. The source lesson MP4 and caption files remain unchanged.
