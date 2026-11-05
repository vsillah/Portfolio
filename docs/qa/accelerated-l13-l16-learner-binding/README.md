# Accelerated L13–L16 correction review

Draft PR #1208 binds corrected L13–L16 composites in the local learner preview. The presenter is inset within the teal well, leaving visible space around the gold frame. The original Human QA approval receipt and original batch receipt remain historical records for the earlier media hashes. The new media hashes are in `docs/accelerated-course-modules/l13-l16-learner-binding/correction-review-receipt.json`; correction Human QA is pending.

Local review route: `http://127.0.0.1:3142/service-prototypes/accelerated-cohort?view=3`, with a `rev` query set to the reviewed PR head. Select each L13–L16 lesson and open its guided video. The corrected L13 player is the primary framing check. Captions, transcript, return to plan, and progress remain visible in the refreshed captures.

`accelerated-l13-l16-learner-walkthrough.mp4` is a 31-second, privacy-safe captured-state walkthrough from the rendered Learning plan in the integrated Codex browser. Its desktop player, transcript, and progress frames were recaptured after the correction. L16 mobile player and transcript frames were also refreshed at 390 px. The separate composite review sheet screenshots in `artifacts/accelerated-l13-l16-native-composite-2026-11-04/` show all four corrected presenter frames together.

Rebuild this MP4 with `docs/qa/accelerated-l13-l16-learner-binding/render-walkthrough.sh`. This walkthrough is a sequence of rendered states, not a full-duration playback recording. No provider job or publication was triggered for this correction.
