# L01 illustrated review candidate

This is the Human-QA-approved **review candidate** for the 345-second L01 segment. The fictional C02 desk illustration is approved only as shown in this candidate. It is not a customer record, a live tool, or automatic data-safety enforcement. The separate 540-second learner media and its binding remain unchanged. The player and walkthrough retain their preapproval concept notice because they are the exact artifacts reviewed.

## Bound artifacts

- `l01-345s-unapproved-c02-local-review.mp4` — 345.000 seconds, 1280×720, 25 fps; SHA-256 `b09b4e6839d2cc0483f0bc32c02ae8e5271dc97f25435218d88e65487b58617f`.
- `../c01-c02-v18-optional-caption-feasibility/lower-captions.vtt` — optional, 175 cues; SHA-256 `427376480d444d321513ddc09c226e7896967909d8baa790b1569dd4a79b508b`.
- `walkthrough/l01-local-player-illustration-walkthrough-v2.mp4` — 37.48-second silent selected-state browser walkthrough; SHA-256 `c69bb20982e0d34f831b34be4eec246a53651fdd480a4702e3fbb8dc2ae659c6`.
- `receipt.json` contains source hashes, the 26-segment frame timeline, audio identity, browser validation, approval scope, and walkthrough capture hashes.

## Reproduce and inspect

Run from the Portfolio repository root with Python, Pillow, and FFmpeg available:

```bash
python3 -B artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/l01-v26-local-review-video/build.py prepare
python3 -B artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/l01-v26-local-review-video/build.py render
python3 -B artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/l01-v26-local-review-video/walkthrough/build.py
```

These commands regenerate review outputs in place, including `receipt.json`. Before running them, preserve the approval receipt and confirm all source hashes. The `prepare` command renders 20 picture assets from the pinned source images and scripts in adjacent folders. `render` assembles the 26 visual segments with the unchanged v19 audio stream. The walkthrough builder uses 14 captured states from the local player; it does not record continuous playback or include audio.

For browser review, start `serve_range.py` from this folder and open its printed local origin at `artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/l01-v26-local-review-video/review.html`. The byte-range server is required for reliable seeking. Captions start off and appear in a separate rail when CC is enabled.

The review media is source-bound and local to this PR. It does not update the learner route, provider state, or deployment.
