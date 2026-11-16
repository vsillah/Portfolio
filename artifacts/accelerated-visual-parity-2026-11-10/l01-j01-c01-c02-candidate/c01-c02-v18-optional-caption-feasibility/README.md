# L01 optional-caption feasibility · review only

Vambah selected optional captions for the next L01 candidate on 2026-11-12. This packet tests source availability and caption placement without rendering a new video or changing learner media. The previously approved v17 MP4 and its Human QA receipt remain historical evidence for that exact always-visible artifact.

## Bound sources and proposed master

`build-stills.py` checks the exact local v13 and approved v17 MP4 hashes, 345.000-second duration, 8,625 frames, and identical copied AAC stream hash `5bef7336fbd6b0716007208d8481ba8bd896768a8ed3c9b7f206a7e1d859c655`. It verifies that all 175 cue words and millisecond times match the prior WebVTT exactly, then adds only `line:72%` to the switchable [candidate track](lower-captions.vtt). The [receipt](receipt.json) binds every source and still hash.

The still proof uses the earlier v13 reel's upper 720 pixels, where P01, C01, P02, and C02 have no raster captions. P01/P02 retain their presenter and active art; C01/C02 are placed at the v17 review's 1100×619, x=90, y=110 layout. A proposed 1280×1080 canvas keeps the claim-bearing content above a larger blank caption/control band. [P01](P01-clean-1280x1080.png), [C01](C01-clean-1280x1080.png), [P02](P02-clean-1280x1080.png), and [C02](C02-clean-1280x1080.png) clean stills show that geometry. Each has a desktop and 390×844 caption/control mock next to it in this folder. The mocks are visual planning evidence, not native-player proof.

## Browser proxy check

The [local player proxy](review.html) uses the still-raster-captioned v13 reel in a 1280:1080 video element, one switchable WebVTT track, and Chrome native controls. It does **not** simulate a finished caption-free video. In Chrome, `http://127.0.0.1:55683/review.html?rev=optional-line72` was inspected at desktop and 390×844 on 2026-11-12. At P01 5.0s, C01 174.4s, P02 240.05s, and C02 250.0s, the new track line was visually readable above the visible native controls and clear of the presenter and claim-bearing illustration. At mobile P01, the toggle changed the track from showing to disabled; at desktop C02, it changed from showing to disabled and back. The old raster text remains visible in this proxy when the track is disabled, as expected from the source. The previous `line:78%` attempt failed mobile control clearance at P01 and is superseded by this `line:72%` review.

## Remaining gate

Render one caption-free 345-second local master from the bound source layers only after a separate exact render authorization. Preserve the approved art, fixed middle-right presenter, original audio stream, and 175-cue timing. Then test the **actual** clean master and final player at desktop and 390×844, including full playback, captions off/on, every section, controls, transcript, keyboard and assistive technology. The proxy cannot prove that the final clean-master pixels or player behavior will match. No HeyGen call, spend, J01/audio change, learner binding, merge, deployment, or release occurred here.

From the repo root, reproduce the stills and source checks with:

```bash
python3 -B artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/c01-c02-v18-optional-caption-feasibility/build-stills.py
```

The local voice-bearing v13/v17 MP4s are intentionally absent from Git; a clean checkout without them fails the source check.
