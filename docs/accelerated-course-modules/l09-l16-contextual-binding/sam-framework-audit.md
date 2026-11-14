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
