# L09–L16 SAM visual audit

The book plate is the visual source of truth whenever a scene depicts the Signals → Alignment → Momentum framework:

`agentified/manuscript/visuals/rendered/print/color-600dpi/figure-0-0-accelerated-sam-loop-print-600dpi.png`

SHA-256: `b7ab226d17f5ae4b421936b0ea541646223f55c0121da328e483941175c39ea3`.

| Scene | Prior art | Reviewed replacement |
| --- | --- | --- |
| L11-03 | Resized showcase SAM image | Canonical book plate |
| L12-01 | Unrelated customer illustration | Canonical book plate |
| L16-01 | Resized showcase SAM image | Canonical book plate |
| L16-06 | Resized showcase SAM image | Canonical book plate |

All other L09–L16 scenes use lesson-specific art and do not depict the full SAM framework. Their media bindings, captions, and hashes remain unchanged. The L12 portrait text correction remains on the new staged source from 86.04s to 147.56s.

The still generator verifies the book plate hash, uses the source image without color enhancement, and preserves the complete plate or a clean proportional crop. The contextual media builder applies the same plate to presenter segments for L12-01, L16-01, and L16-06 in the teaching region beside the native presenter. The staging receipt records the canonical source, affected scenes, source master hashes, staged hashes, audio stream hashes, encode similarity, duration, and caption source hash. The binding verifier checks the canonical hash and these scene assignments.

The six rebuilt source masters retain the exact prior audio stream hashes: L11 `c9ee58f0044831e01ba5c068fe642db93bc4850556b06d86a77ebcffe94e5268`, L12 `60fa992c5d4a6fc134c8ab7599ecf160756523717ea7b08e434052e383092a23`, and L16 `3cb3705ec2a4a8d49293debdd97ef072527cc075f587a8d07c2ace4dc8013bc5`. Each hash is shared by the desktop and portrait variant. These assets remain `human_qa_pending`; the repair does not authorize publication or deployment.

## Paused-player poster repair

Browser QA found a separate L12 mismatch: the old 0:00 poster (`efa6782801a66b0cbea9a1b09d274b6ea45edbdcae5c17b28fe8f54de274abe0`) still showed a circular substitute even though the opening MP4 was corrected. The replacement desktop and portrait posters use the complete canonical plate and the native opening presenter frame. Both are bound by content-addressed paths, and the portrait player selects its own 390×844 poster. The L11 poster remains a lesson-specific loop image, and the L16 poster's small book inset is not a substitute for the complete SAM scene; their poster hashes remain `40becd9de93aa0da2931cdb6542c0414abf80fa468073138ac10faccec5a8f43` and `6d4efe4618fdc920b47af6d65d1e0424845036cdd70d7e6cebbb67cf75f64cf6`.

The [L12 poster receipt](l12-poster-receipt.json) binds both poster hashes to the canonical source, native opening video, and actual desktop and 390×844 browser screenshots captured while paused at 0:00. Run `python3 scripts/qa/verify-accelerated-l12-poster.py` to verify the source and poster hashes, screenshot hashes and dimensions, and that the visible player pixels match the new poster above the browser controls. This catches a stale paused-player image even when MP4 frame checks pass.

The same QA packet contains short [desktop](../../../artifacts/accelerated-l12-poster-qa/l12-paused-to-playback-desktop-a0fa465ab.mp4) and [390×844](../../../artifacts/accelerated-l12-poster-qa/l12-paused-to-playback-mobile-a0fa465ab.mp4) browser playback clips with the original L12 audio. They begin at the paused opening and show the transition into the encoded lesson. The receipt binds their hashes, dimensions, frame counts, and duration.
