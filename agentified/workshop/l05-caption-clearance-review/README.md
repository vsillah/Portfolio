# L05 caption-clearance review

Review-only correction for draft PR #1293. Exact code commit: `914096bd2e872b4ab0962d9b22e15c82e4c26efa`. The only PR #1290 fixed-padding candidate for this lesson is L05-01 at exact draft head `d047960edcf58bc2c75b3a944fe22a5d8ad25bb4`. The candidate is separate, byte-bound, and **not** learner media. PR #1290 contains no L05-02–L05-08 candidate clips.

## Result and boundaries

Desktop Small and Medium keep native captions during the protected 0–11.91-second presenter opening. Its eight original one-line cues use native cue line 10% in the upper video field, clear of the presenter face, recorded background focal area, and “One request needs a visible path” panel. At mobile width the native cue geometry returns to `auto`, while the existing external band displays the cue. Desktop Large also keeps the external band.

From 11.91 seconds through L05-08's final cue at 234.398 seconds, the existing band below the video clears teaching labels, panels, transition art, the exercise card, and the final Operating File card. It disappears in cue gaps and when captions are off, and restores the active cue when paused or turned back on. At the 234.398-second protected end screen, the band is absent and the L05 track remains hidden so Chromium cannot paint a lingering native cue. Video, audio, artwork, presenter footage, player geometry, native controls, caption words and timing, and learner media bindings are unchanged.

## Source and candidate binding

- Approved L05 learner video: `/agentified/lessons/l05/illustrated-aa9b234a/agentified-l05-illustrated-composite.mp4`; SHA-256 `aa9b234ae717b8c54f90c1200db4f1657a21095b1714c33023cdc0431b062061`.
- Approved L05 captions: `/agentified/lessons/l05/continuous-1cd79d31/agentified-l05-continuous-narration-captions.vtt`; SHA-256 `25e7735ad4209bce2bcf50098d10846da39f655a35468526b559123d34700389`.
- PR #1290 L05-01 review candidate desktop/mobile MP4 SHA-256: `fdb92e85a0ffc2b12da31d57ca12f00aef71bb5619abf31a7be0f19e1670cd68` / `bc3bf65bc2fe31f87b5ab604ce6ec96cf58bbc0804691e1df5fe64892651c739`.
- Both candidate VTT files SHA-256: `962fe1fc28dbf072d65bb32de683b0f97fb438cc84da1c54fb7f7749df1d4061`.

The full source paths, hashes, states, and timestamps are in `receipt.json`. `walkthrough-state.json` binds the recorded steps to the exact localhost route and code commit. Earlier L05-01, L05-02, and protected-opening stop records are retained as historical evidence; their reproduced collisions are cleared in this packet.

## Validation

- `vitest run` for caption controls, Agentified hero/workshop, Accelerated Learning Plan, and end-screen bindings: 86 passed.
- `node --import tsx scripts/verify-agentified-illustrated-binding.mjs`: all 16 source, composite, caption, transcript, and duration bindings passed.
- ESLint on the changed TSX files, Node syntax checks for both consolidated QA scripts, and `git diff --check`: passed.
- `node scripts/qa/verify-l05-caption-clearance.mjs`: 242 learner states at 1280×720 and 390×844, plus six exact PR #1290 L05-01 candidate states. Checked the eight opening cue positions, all eight L05 scene starts/midpoints/end edges, S/M/L, captions off/on and paused restoration, source cue text and timing, video dimensions, controls, no added document width, dark theme, natural playback across every scene boundary, and the protected end screen.
- `node scripts/qa/record-l05-caption-clearance.mjs`: 132 walkthrough states and four FFmpeg-decoded MP4s. Extracted final encoded frames were visually checked at the presenter, teaching, and end-screen states.
- Visual stills include `L05-1280-presenter-{S,M,L}-on.png`, `L05-1280-L05-03-mid.png`, `L05-1280-L05-07-start.png`, `L05-1280-L05-08-mid.png`, `L05-1280-end.png`, `L05-390-presenter-M-on.png`, `L05-390-dark-theme.png`, and played-through boundary frames for desktop and 390.

## Walkthroughs

- `L05-learner-1280-914096bd2e.mp4`
- `L05-learner-390-914096bd2e.mp4`
- `L05-candidate-desktop-914096bd2e.mp4`
- `L05-candidate-mobile-914096bd2e.mp4`

These use local synthetic-session review routes. No live workflow or customer-data smoke was run. No provider action, media bind, spend, merge, deployment, publication, or release occurred. Both Vercel contexts remain unchecked in this development lane. Downstream draft PR #1294 touches the same hero component; captain reconciliation and client-facing Human QA remain separate gates.
