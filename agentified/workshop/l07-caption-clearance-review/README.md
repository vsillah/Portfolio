# L07 caption clearance review

This review uses the preserved caption branch with PR #1292's teaching-detail synchronization fix, PR #1295's mobile player head, and PR #1296's L07 candidate MP4. The player merge, candidate file, and learner binding were temporary local QA inputs. The published learner binding is not changed by this PR.

The cue-driven external band covers L07-01 through L07-07 at desktop S/M and mobile widths, clearing teaching labels, choice chips, and writing fields. L07-08 keeps its native desktop S/M captions below the checklist and closing presenter. Large captions use the external band. The L07-07 human-review detail retains the exact `[188.515, 233.515)` source interval and wording from PR #1292.

`matrix.json` records 240 source-bound learner states at 1280×844 and 390×844: every scene, source boundaries, S/M/L, captions on/off/restored, cue gaps, paused seeks, natural playback, controls, completion, and replay. PNGs show representative caption sizes and teaching scenes. `L07-1280-context.mp4` and `L07-390-context.mp4` show the exact review route with captions on and off across the lesson. `receipt.json` binds the source heads, hashes, matrix, and MP4s.

These are review artifacts. PR #1293 remains draft; this review does not merge, deploy, publish, activate a provider, or bind the candidate media for learners.
