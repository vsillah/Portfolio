# Accelerated Lesson 04 illustrated review source

**Status:** local-only Human-QA candidate approved by Vambah for packaging into draft PR #1270. Integration Captain review, full-lesson listening, and any learner-media decision remain separate gates. Source branch at approval: `codex/accelerated-lesson-pacing-audit`, commit `d4479c5b75506d4d2ceb778061d48c72f755ad68`.

This bounded package reproduces the approved desktop and portrait review compositions. It contains seven selected original generated illustrations, their exact prompts, source paths, SHA-256 digests, and rights records in `scene-art-provenance.json`; the final timing contract; renderer and caption builders; optional VTT tracks; compact visual evidence; and hash-bound receipts. See `package-manifest.json` for the selected file list and excluded input bindings.

## Approved local review outputs

| Output | SHA-256 |
| --- | --- |
| Desktop 1920 × 1080 MP4, 399.324 s | `a56cee03509ebb46030a4582a19887875c3568cea94cf8a4141ba47ee91efd86` |
| Portrait 390 × 844 MP4, 399.324 s | `71fbfdafbcb7c29be9c23de2d5c5f40cc15a7fcbb82adb999ac90653d20635f4` |
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
python3 -B artifacts/accelerated-l04-contextual-preflight-2026-11-13/validate-package.py
```

The first four commands should preserve the checked-in contract, caption, and preflight bindings. The renderer writes local MP4s and intermediate WAV under `whole-lesson-review/`. Compare the new output hashes to the table before using them for review; a mismatch is a failed reproduction, not approval to replace the recorded outputs. The `--desktop-only` renderer option is an incremental path that requires the approved portrait MP4 already present and hash-matched.

## Review evidence

- `scene-art-desktop-contact.jpg` and `scene-art-portrait-storyboard.jpg` show the seven source illustrations and portrait framing.
- `whole-lesson-review/qa-desktop-expanded-presenter-encoded-contact.jpg` and `qa-portrait-presenter-section-encoded-contact.jpg` show P01–P04 from the exact approved encoded MP4s.
- `whole-lesson-review/native-caption-alignment-gate.json`, `render-receipt-desktop-expanded.json`, `portrait-caption-qa-receipt.json`, and `desktop-expanded-qa-receipt.json` bind source, timing, render, captions, and technical checks.
- `whole-lesson-review/HUMAN-QA-PACKAGE.md` gives the local review path and remaining listening gate. The local player links work only where the excluded MP4s and range-capable server are present.

## Boundaries

The package excludes provider-returned generated WAV and timing payloads, native presenter media, derived PCM/WAV, model weights and cache, transient clips/frames, superseded candidates, browser scratch, and full whole-lesson MP4 masters. It excludes unrelated untracked Lesson 03 files. No HeyGen contact, new spend, learner-media change, merge, deployment, publication, or release is part of this PR update.
