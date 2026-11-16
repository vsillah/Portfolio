# P02 simplified SAM still gate: failed

Scope: one review-only, still-only composition pass after `3c26a599` on `codex/accelerated-lesson-pacing-audit`. Three section views used their owned SAM heading and one source-art motif, plus a separate complete-map view. The fixed presenter source anchor remained `(1136,348,672,384)` on 1920×1080. Eight local desktop/390×844 still files were generated with simulated controls. No video render was attempted.

The first inspected 390×844 still, Signals, failed source-art integrity. Its motif crop cuts through the lower funnel and leaves part of the neighboring `STRUCTURE IT` label on the right. The section heading is readable, but the supporting source-art subtitle is too small. The visible controls did not overlap the heading or cropped motif; final caption clearance remains unverified. The desktop still and the other section views were not evaluated after this first failed check, as required by the stop rule.

Local evidence:

- `p02-simplified-stills/p02-signals-390x844-controls.png` SHA-256 `5881a7fdd04fb6e6658169fe476fb78a0c450e3cdca95b703bfe6cf8884765fb`
- `p02-simplified-stills/p02-signals-desktop-controls.png` SHA-256 `653a053671ef0e44f48ae8f2180d7d1dab7276e2d91d80c35c3d9a6eb0a7ffb7` (generated, not evaluated)
- `p02-simplified-stills/receipt.json` records all generated still paths and hashes. These presenter-bearing stills and the experimental builder remain local and uncommitted.

Result: stop with no crop retry, no video, no HeyGen, no spend, no learner-media or J01 timing change, no merge or release, and no Human QA readiness claim. A later attempt needs a source-art motif with a complete boundary and mobile-readable meaning; this pass did not establish that treatment.
