# L01 P01→P02 fixed-anchor motion check

**Result: REJECT.** The [12.8-second local MP4](l01-p01-p02-anchor-motion.mp4) uses only native presenter video and audio from source 24.0–28.4s, the approved moved sentence at 28.4–30.8s, and retained P02 at 235.0–241.0s. Review labels mark P01, the moved sentence over P02, and retained P02. The video was fully decoded at 1280×820, 25 fps, 320 frames. It contains no J01 narration.

The first slide handoff holds the proposed fixed upper-right rectangle. At **reel 6.84s**, the transition to retained P02 shows one encoded frame with the presenter absent from that rectangle; the presenter returns at **6.88s**. Compare the [failed frame](motion-fail-6p84.png) and [next frame](motion-recovered-6p88.png). The [failure receipt](motion-failure-receipt.json) binds both stills and the local MP4 by SHA-256. This is a motion/layout failure even though the source-bound technical [reel receipt](motion-review.json) passes duration, frame-count, and full-decode checks.

The reel remains local and ignored by Git because it contains voice media. It is not a Human-QA artifact or learner replacement. Work stopped at the first reproducible motion failure. Narrow browser playback, native-control clearance, caption obstruction, and full listening were not claimed. The separate C01/C02 candidate still has two ordinary pauses over 2.5 seconds; no timing retry or full candidate render occurred here.

To reproduce the local reel from commit-bound sources: `python3 -B scripts/qa/build-accelerated-l01-anchor-motion.py build`. To verify its technical receipt without rebuilding: `python3 -B scripts/qa/build-accelerated-l01-anchor-motion.py check`. Neither command resolves the recorded visual failure.
