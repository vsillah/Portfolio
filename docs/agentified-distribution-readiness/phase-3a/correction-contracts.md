# Bounded correction contracts

All baseline hashes are from the accepted Phase 2 qualification manifest. These are local contracts; no learner binding was changed.

## L01: duration and end screen

The bound composite is `1eeaa68bde9529da7e2aeb8ccbd36b4dd41c56f408e191792765230b9c861775`; caption is `6dee645eafea79649d17711c589a84acbe45a478b7a5994f718ccbbc6297492e`. The declared 378.059 s is 0.226 s shorter than the encoded 378.285 s. The last cue ends at 359.645 s; the end-screen visual already exists in the L01 continuity source, but `lib/agentified-end-screens.ts` has no L01 hash binding. Phase 3B should choose a single exact duration authority, inspect the final frames, and bind L01 to the established YouTube-style resting/end-slide pattern for progress 1 and L02 as next lesson. Preserve the approved ending copy and video/audio stream until a reviewed binding candidate proves the chosen timing. Test replay, seek, pause and manual completion independently. Stop on end-slide mismatch, hidden controls, premature completion, or a timing delta beyond the measured 0.226 s without explanation.

## L10: local VTT candidate

The baseline VTT is `e54bdfb260e186474ec496a72e2031716a8ddab89594eff6fdc940f1e35df1b8`. [`l10-captions-candidate.vtt`](l10-captions-candidate.vtt) ends the seven-field envelope cue at 03:04.360, exactly when “Mark it unapproved” begins. It removes the 0.640 s collision and changes no words or other cue timing. [`l10-caption-receipt.json`](l10-caption-receipt.json) records both hashes. Before binding, listen to the full 02:46–03:16 section; if the first phrase is still audible beyond 03:04.360, stop and retime a bounded pair of cues against actual speech. Do not silently truncate spoken meaning.

## L16: meaningful end dwell

The bound composite is `4283c8d8fb7eca85b9b0493aa07ac22901f0155d0742ebc61c0a0744698846fc`; caption is `18dd5bebac74af34048e62b8f6171daefea89ddfc86618a82cc2b74472936060`. Its last cue ends at 267.222 s and the container ends at 267.309 s: only 0.087 s of the registered end screen is visible. Phase 3B should extend the approved Agentified ending treatment to a meaningful 8 s silent dwell after the final cue, with normal-speed native presenter footage and all original audio/words/timings preserved before that boundary. The existing L16 closing-card receipt says the card overlays the final presenter passage; verify the intended final resting composition before rendering. Do not use the L01 next-lesson graphic, which names L02. A local rendered candidate is held until the final L16 resting composition is source-bound and the overlay/presenter handoff is visually resolved. Compare original and candidate frame count, audio PCM before the boundary, last caption, end screen visibility, and 390×844 control clearance.

For every media render, keep original immutable sources and SHA-256 receipts, use a reproducible FFmpeg command, and review the actual MP4. If a presenter segment degrades under a programmatic render, composite its native MP4 and native audio at exact times and compare source/final crops and frame counts.
