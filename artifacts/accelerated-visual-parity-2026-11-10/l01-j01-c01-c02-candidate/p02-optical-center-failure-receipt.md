# P02 optical alignment: failed local review

Status: **REJECT_STOPPED_AT_CONTENT_ALIGNMENT**, 2026-11-11. One review-only P01→P02 reel was rendered from branch `codex/accelerated-lesson-pacing-audit`, source commit `63f6efe0`. The local voice-bearing [reel](l01-p01-p02-middle-motion.mp4) has SHA-256 `1e0c58b90a0d97bff36a303d3431791634b9a1de2e7ac421308ac5ead9a1a0ee`. It remains ignored by Git and is not a Human QA artifact.

The candidate extends each owned SAM crop and fades its lower edge rather than making a hard cut through the visible icon. Desktop and 390×844 Chrome playback showed readable Signals, Alignment, and Momentum headings, a fixed presenter, native-control clearance, and the complete-map return. The whole map and its gold footer were unchanged. The source presenter remains `(1136,348,672,384)` with center y=540 (rendered y=360). The candidate crop box is `(240,308,600,491)`, center y=553.5; its authored focal-line estimate was y=539.86. That estimate did not predict the rendered content weight reliably.

An encoded-frame bright-content check within the left teaching region `(150,180)–(570,540)` at 1280×720 counted gold and light pixels, then averaged their y positions. It is a **proxy for optical weight**, not a semantic segmentation or a replacement for viewing the frames. Results relative to the presenter centerline y=360:

| Focus | Prior encoded frame | Candidate encoded frame | Candidate offset |
| --- | ---: | ---: | ---: |
| Signals | y=344.3 | y=338.0 | 22.0 px high |
| Alignment | y=328.2 | y=330.7 | 29.3 px high |
| Momentum | y=348.1 | y=349.4 | 10.6 px high |
| Whole map | y=385.3 | y=385.3 | 25.3 px low; unchanged context view |

Signals moved farther from the presenter center under this measure, and Alignment remained materially high. The actual encoded frames also show a large heading band above the more salient icon group. This fails the requested meaningful-art alignment gate. Stop here; the crop coordinates alone are not approval evidence.

**Local before/after evidence:** [Signals before](P02-encoded-before-signals.png) / [after](P02-encoded-after-signals.png), [Alignment before](P02-encoded-before-alignment.png) / [after](P02-encoded-after-alignment.png), [Momentum before](P02-encoded-before-momentum.png) / [after](P02-encoded-after-momentum.png), and [whole map before](P02-encoded-before-full-map.png) / [after](P02-encoded-after-full-map.png). Simulated-control after stills are `P02-optical-after-{signals,alignment,momentum,full-map}-{desktop,390x844}-controls.png`. These presenter-containing images stay local and uncommitted.

Technical checks before the stop: 320 frames, 12.821333 seconds, full decode, and decoded PCM identity to the preserved prior reel (2,482,176 bytes; SHA-256 `b86a0394c94c793529d3b4c75ea8031975ddd328cac7de4962bcace963b76c97`). The one copied AAC track preserves the prior joins; no separate listening claim. The short reel has no captions, so final caption-safe playback is untested. No second render, corrective retry, learner-media or binding change, J01 timing retry, HeyGen, spend, merge, or release occurred.
