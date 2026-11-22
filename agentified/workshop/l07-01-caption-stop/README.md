# L07-01 candidate caption pass: adjacent-scene stop

## Binding and local code

The local-only caption code commit is `da00fba64` on `codex/agentified-caption-safety`; draft PR #1293 remains at `37a1b4a77d58468af2aba9aaf4222c5199a4e71f`. The candidate came from draft PR #1296 exact head `b11360d1dc0b63a1d9c7ea126aa50dea196fa649`; its SHA-256 was verified as `b9016102fc8272f1c51f1fcee9b5f0aafe5c8928988beaf970645e337446a5b4`. The approved L07 VTT SHA-256 was `984fa64e556279730d30a602b3ce160620822ef0577a7ff6cf7de7028e3f8f21`. The current caption code combined cleanly with player head `7bb6267c9fb98172679e161aafa208dfc7a276c3` (merge-tree `041811d8f8461ba0b1f2c360f2963973384b184c`).

A temporary local learner binding exposed the #1296 candidate at `/agentified/lessons/l07/review-b9016102/L07-01-source-brief-candidate.mp4`. The corresponding end-screen hash was changed only for this disposable QA state. The branch's persistent learner media binding was not edited.

## Visual finding

At 3.2 seconds, desktop and 390×844 screenshots show the exact active cue in the existing band below the candidate video. The source headline, three populated rows, and native presenter remain clear; see `L07-01-1280-band-clear.png` and `L07-01-390-band-clear.png`.

At 28.2 seconds, immediately after the authorized L07-01 interval ends at 27.99 seconds, the adjacent L07-02 native desktop cue crosses the “Outcome” and “Acceptance tests” labels. See `L07-02-1280-adjacent-overlap.png`. This is a caption/content overlap outside the narrow L07-01 correction. Stop before the full matrix, MP4 handoff, or push under the stated stop condition. Do not extend the caption rule into L07-02 without a new bounded scope.

No provider action, spending, merge, manual deployment, media binding, publication, or release occurred.
