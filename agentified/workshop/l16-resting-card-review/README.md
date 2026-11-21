# L16 resting-card completion handoff

Review build: `a2f7543b281530e0b64b4fce8b21e263515afe36` on `codex/agentified-l16-resting-card-handoff`, stacked on PR #1293 head `32f44fb97fd4c9ecbd04cf0e367f1c767464e282`.

Route loaded: `http://127.0.0.1:3108/agentified/learningplan?lesson=L16&rev=a2f7543b281530e0b64b4fce8b21e263515afe36`. The page initially displays L01 despite `lesson=L16`; the recorder selects L16 in the lesson navigation after hydration. On mobile it first expands the navigation. Each run uses an isolated browser context with guest progress only.

The recorder substitutes the **unbound** candidate MP4 response for the existing L16 video URL. It does not edit the media binding. Candidate: `agentified/workshop/phase-3b-review/L16/agentified-l16-resting-composite.mp4`, SHA-256 `5e5159a626a3cc3c5ef43ce679fcd451140895b0717db572b01fb1ed01496a3c`, 275.32 seconds. The approved bound video remains 267.309 seconds. This qualifies the end-screen interaction with the candidate; it does not approve or bind the candidate media.

At 1280×720 and 390×844, the run selected L16, verified candidate duration, toggled captions off/on and Aa Large/Medium, sought to 266.5 seconds, played naturally past the old 267.222-second trigger, confirmed no early overlay, waited for the actual media end, confirmed one completion overlay, then sought backward and replayed to confirm the overlay clears. The MP4s show the setup and these transitions; corresponding PNGs capture the boundary, resting card, completion, and replay. MP4s were decoded with FFmpeg after conversion.

- Desktop MP4 SHA-256: `057c1d9ae1a4553d42d956cb741ff3d135db04d9277893f972e69310825fee9e`
- Mobile MP4 SHA-256: `381b6a7bc2dc802c6b2bf19e4f3f6726d8b76cb44077ec75e13e8deb13cfaaf9`

Command: `node docs/agentified-distribution-readiness/phase-3b/record_l16_completion.cjs a2f7543b281530e0b64b4fce8b21e263515afe36` against the localhost server started from that commit on port 3108.

The browser's native controls remain visible below the completion panel so replay remains available. The candidate stays unbound pending separate source and distribution approval. The broad TypeScript check still fails in unrelated existing files; the focused Agentified suites pass.
