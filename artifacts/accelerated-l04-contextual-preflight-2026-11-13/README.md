# Accelerated Lesson 04 illustrated review source

**Status:** corrected local desktop and portrait editorial-plate candidates approved by Vambah for packaging into draft PR #1270. The portrait renderer now uses one illustration layer per cutaway. Integration Captain review, PR validation, and any learner-media decision remain separate gates. Source branch: `codex/accelerated-lesson-pacing-audit`.

This bounded package reproduces the approved desktop and portrait review compositions. It contains seven selected original generated illustrations, their exact prompts, source paths, SHA-256 digests, and rights records in `scene-art-provenance.json`; the final timing contract; renderer and caption builders; optional VTT tracks; compact visual evidence; and hash-bound receipts. See `package-manifest.json` for the selected file list and excluded input bindings.

## Approved local review outputs

| Output | SHA-256 |
| --- | --- |
| Desktop editorial-plate MP4, 1920 × 1080, 399.324 s | `4ea135cbb7543116f82a9777067c74027331175a09122de74421e8064ff511ae` |
| Corrected portrait editorial-plate MP4, 390 × 844, 399.324 s | `9c49ae07f4605f15baca89eb52c2b304e339faaef3fd27a3bcadf5e0d3cb5498` |
| Desktop optional VTT | `3773ab5ceec12987ddf3837bc30390613f5b0d18cbf527bcea4a6e3f615e6691` |
| Portrait optional VTT | `597f740705c236174463180a57cafb94deb7c784c67f7e7f14f74960719f18a5` |

The MP4 masters are local review outputs and are intentionally excluded from Git. The source code never writes to `public/accelerated`.

## Reproduce locally

From the Portfolio repo root, use Python 3 with Pillow 13.0.0, FFmpeg/ffprobe, and the already authorized local source inputs listed in `package-manifest.json`. Restore the native presenter MP4 and provider-returned J01/J02 WAV and timing JSON files at the contract paths. The scripts verify their hashes before rendering. The ASR and waveform JSON needed to regenerate the desktop VTT are also local-only inputs recorded in `whole-lesson-review/native-caption-alignment-gate.json`; the approved VTTs themselves are in this package.

```bash
python3 -B artifacts/accelerated-l04-contextual-preflight-2026-11-13/build-timing-contract.py
python3 -B artifacts/accelerated-l04-contextual-preflight-2026-11-13/build-optional-captions.py
python3 -B artifacts/accelerated-l04-contextual-preflight-2026-11-13/build-portrait-captions.py
python3 -B artifacts/accelerated-l04-contextual-preflight-2026-11-13/build-whole-lesson-review.py --stills-only
python3 -B artifacts/accelerated-l04-contextual-preflight-2026-11-13/build-whole-lesson-review.py
python3 -B artifacts/accelerated-l04-contextual-preflight-2026-11-13/whole-lesson-review/build-teaching-overlay-review.py
python3 -B artifacts/accelerated-l04-contextual-preflight-2026-11-13/validate-package.py
```

The first four commands should preserve the checked-in contract, caption, and preflight bindings. The renderer writes local MP4s and intermediate WAV under `whole-lesson-review/`. Compare the new output hashes to the table before using them for review; a mismatch is a failed reproduction, not approval to replace the recorded outputs. The `--desktop-only` renderer option is an incremental path that requires the approved portrait MP4 already present and hash-matched.

## Review evidence

- `scene-art-desktop-contact.jpg` and `scene-art-portrait-storyboard.jpg` show the seven source illustrations and portrait framing.
- `whole-lesson-review/qa-desktop-expanded-presenter-encoded-contact.jpg` and `qa-portrait-presenter-section-encoded-contact.jpg` show P01–P04 from the exact approved encoded MP4s.
- `whole-lesson-review/l04-teaching-overlay-plan.json` binds every short teaching point to its narration cue and the shared `accelerated-editorial-teaching-plate-v1` contract.
- `whole-lesson-review/l04-teaching-overlay-render-receipt.json`, `render-receipt-intact-native-background.json`, `portrait-caption-qa-receipt.json`, and `portrait-single-image-qa-receipt.json` bind source, timing, render, captions, image-layer count, and actual-player checks.
- `whole-lesson-review/HUMAN-QA-PACKAGE.md` gives the local review path and remaining listening gate. The local player links work only where the excluded MP4s and range-capable server are present.

## Boundaries

The package excludes provider-returned generated WAV and timing payloads, native presenter media, derived PCM/WAV, model weights and cache, transient clips/frames, superseded candidates, browser scratch, and full whole-lesson MP4 masters. It excludes unrelated untracked Lesson 03 files. No HeyGen contact, new spend, learner-media change, merge, deployment, publication, or release is part of this package update.
