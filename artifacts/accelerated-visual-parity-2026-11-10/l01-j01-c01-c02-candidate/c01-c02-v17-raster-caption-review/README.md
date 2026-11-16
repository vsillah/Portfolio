# Accelerated L01 four-section caption review source

This package records the **local review-only** P01/C01/P02/C02 caption layout approved in Human QA on 2026-11-11. The approval is bound to draft PR #1270 at source commit `3a2df476a96d3106823537c2442a72bd69a95080` and local MP4 SHA-256 `80a1be496b7b05e1ae7bf6bff2cd00e2410374e6c8abe65e280fe7e4c444d0d1`. See `receipt.json` for the exact scope and observed checks. This package does not bind learner media or authorize a merge, deployment, or release.

## Inputs and reproducibility boundary

`build-local-review.py` reproduces the **final caption transform** when the exact local voice-bearing input below is present. Neither input nor approved output MP4 is committed. A clean checkout without the input cannot render this artifact; the renderer fails closed rather than substituting another video.

| Input | Location relative to this folder | Required SHA-256 |
| --- | --- | --- |
| Prior local review MP4 with approved C01 art and C01/C02 top captions | `../c01-c02-v15-all-captions-review/l01-c01-c02-v15-all-captions-review.mp4` | `3fba2f2bd724f4da1e5778138a95765b4b5946e478e8b52598ac9124e5a0d869` |
| Exact 175-cue timing and words | `caption-plan.json` | `d917317e98f7dc05590e714097af9faf00a9c09236ce894a18c214ce9138b21e` |
| Approved C01 still receipt | `../c01-visual-still-audit-v13/receipt.json` | `b6776a7ae75e564211d353e5e4e1184d97dbdab5c8b9e00eed78f04d048a1ccb` |

The plan binds the original J01 WAV at SHA-256 `24ce83730c2112a52fee7e765794c29c771886ad103094ddff53511d33491360`. The final transform copies the prior MP4's AAC stream unchanged; its stream hash is `5bef7336fbd6b0716007208d8481ba8bd896768a8ed3c9b7f206a7e1d859c655`. No WAV is required or written by this final transform.

The renderer replaces P01 and P02 bottom captions with transparent raster captions in the top-right band. It crops the old bottom caption strip and preserves the visual pixels and presenter position in the upper 720 pixels. C01 and C02 are passed through with their approved top captions and illustration sequence. Cue text and timing are read from `caption-plan.json`; the four sections contain 18, 102, 8, and 47 cues respectively.

## Local commands

From the repository root:

```bash
python3 artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/c01-c02-v17-raster-caption-review/build-local-review.py preflight
python3 artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/c01-c02-v17-raster-caption-review/build-local-review.py inspect
```

`preflight` checks the bound source/plan, AAC stream, all cue boxes, and a one-frame raster overlay through the available FFmpeg filters. `inspect` additionally checks the approved local MP4 hash, duration, frame count, full decode, and copied audio. Observed toolchain: FFmpeg 8.1.1 and Pillow 13.0.0 on macOS.

To make a new local output only when the target MP4 is absent, run the same script with `render`. It writes `render-output-receipt.json` and refuses to overwrite an existing MP4. Compare its SHA-256 with the approved hash before making any equivalence claim; encoding bytes may vary across toolchains. `review.html` and `serve_range.py` are localhost-only playback helpers with byte-range support.

The approved local MP4 remains outside Git. Subjective speech-join listening was unavailable to the agent; the audio stream identity and sampled desktop/mobile playback checks are recorded in `receipt.json`. Human QA approval applies only to the hash-bound local artifact, not to learner binding, merge, deployment, or release.
