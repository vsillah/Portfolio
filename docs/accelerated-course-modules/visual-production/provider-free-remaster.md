# Accelerated provider-free visual remaster

This package redraws the 98 teaching scenes in L01–L16 while preserving the approved lesson soundtrack, embedded subtitle stream, external VTT, native presenter footage, 25 fps frame count, and scene boundaries. It uses local Pillow and FFmpeg only. No media provider or paid API is called.

## Source and derived records

- The source script and scene timing are `manifest.json` in this directory.
- `lib/accelerated-end-screen-bindings.json` pins the sixteen original MP4s, VTTs, and posters by SHA-256. Those originals remain in `public/accelerated/lessons/`.
- `scripts/qa/accelerated-scene-concepts.tsv` supplies a source-specific visual model for each scene. The renderer checks the set of 98 IDs exactly.
- The approved local SAM infographic, Signals/Alignment plates, and public Accelerated book cover are hashed in `artifacts/accelerated-visual-parity-2026-11-10/scene-receipt.json`. They keep their natural aspect ratios.
- The scene receipt records every illustration and presenter background hash. `composite-receipt.json` records each derived MP4, source MP4, captions, presenter window, and duration. `lib/accelerated-visual-parity-bindings.json` is the learner-player binding for the derived MP4s.

## Rebuild and verify

From the repository root:

```bash
python3 scripts/qa/render-accelerated-visual-parity.py
python3 scripts/qa/compose-accelerated-visual-parity.py
python3 scripts/qa/stage-accelerated-visual-parity.py
python3 scripts/qa/verify-accelerated-visual-parity.py
```

The compositor refuses source, caption, frame, or script drift. It replaces the teaching region with the corresponding illustration and preserves the original presenter panel during its exact native windows. L16 closes with a timed SAM-to-book-cover sequence before the final in-stage next-action overlay. The verifier checks all sixteen output hashes, durations, frame counts, byte-identical copied audio and subtitle streams, and presenter-pixel similarity at a native-window sample.

The course player has no separate guided-work countdown. Its existing playback, seek, captions, progress, and Decision File behavior remains in the React player. The end slide appears only after native playback ends at the final caption boundary and clears on seeking or replay.
