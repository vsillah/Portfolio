# L01 P02 approved SAM plate review

Status: one local, review-only P01→P02 motion candidate. No learner media or binding was changed. The prior crude SVG redraw was rejected and removed from this branch; its historical Git commits and local review files remain available as a failure record.

## Source and layout

The P02 full-map view uses `public/showcases/service-prototypes/accelerated-sam-infographic.png` (SHA-256 `13ef37fb39a228c79253538174cd9b3d77f6c7e630e9929dfa99e6cfa97f45c6`). The three focus views use the approved high-resolution plates in `public/showcases/service-prototypes/v2/`:

| View | Source | SHA-256 |
| --- | --- | --- |
| Signals | `sam-signals-plate.webp` | `8554d40fb4e5471c61c7c3e530da80bfa07c7a77ab34afb79eecfb9945985e6c` |
| Alignment | `sam-alignment-plate.webp` | `82b9fd4429387182e4fab545ecd11a3cd7174794fd9c9b0f9fbda6606b4c72a0` |
| Momentum | `sam-momentum-plate.webp` | `8b32de9f499e3fdefadcb847ac1032dac27405f74fde844af9c53ae1b4a5d2d3` |

Each plate retains its full proportions and internal detail. A single section heading sits above the art; the plate itself carries the visual explanation without repeated text overlays. The native presenter stays at source-frame `(1136,348,672,384)`. The three focus backgrounds matched the reviewed stills pixel for pixel in the artwork area. These are teaching illustrations; they do not establish product outcome claims.

## Local review artifacts

- Stills and source receipt: `artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/p02-approved-plate-stills/` (four views at desktop and 390×844 with simulated controls).
- One motion reel: `artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/p02-approved-plate-motion/l01-p01-p02-approved-plate-motion.mp4` (SHA-256 `d997d35fbe7261a45c779749e55d332df437335cbb1d0f2284fd33c19b13d99e`). It is 12.821333 seconds, 320 video frames at 25 fps.
- Transition contact sheet and `motion-receipt.json` in the motion directory. The reel moves from P01 to the full SAM map, then through Signals, Alignment, Momentum, and back to the map. Each change uses a five-frame background dissolve while the presenter stays on its native frame track. One copied native AAC track spans the reel.

Rebuild stills with `python3 -B scripts/qa/build-accelerated-p02-approved-plate-stills.py` and the one review reel with `python3 -B scripts/qa/build-accelerated-p02-approved-plate-motion.py render`. Recheck an existing reel with `python3 -B scripts/qa/build-accelerated-p02-approved-plate-motion.py check`.

## Checks and limits

Full decode, frame count, duration, source hashes, and decoded PCM identity against the prior native audio track passed. Transition boundary frames were inspected. Chrome played the MP4 at desktop and 390×844; the narrow native controls stayed visible and did not cover the section artwork or presenter. In-app Browser was unavailable, so Chrome was used for rendered playback.

This short reel does not contain or validate learner captions. Final caption timing and placement, the complete lesson's narration alignment, and the actual learner player remain unverified. Keep Human QA and learner-media binding pending. Voice-bearing MP4s and presenter-bearing evidence remain local and Git-ignored. No J01 timing, HeyGen, provider action, spending, merge, or release is included.
