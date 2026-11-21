# L01-02 caption clearance review

Code commit: `97ca5bf242002be6cfe735f55aa367d010580ab2`. Fixed-padding candidate: exact PR #1290 head `16f26aa19411e8303f9cdad5b6c4ad5f1d4fb824`. The candidate MP4/VTT bytes are copied unchanged into `candidate/` for standalone review and are **not** bound to the learner route.

## Binding and scope

- Learner route: `http://127.0.0.1:3137/agentified/learningplan?lesson=L01&rev=97ca5bf242002be6cfe735f55aa367d010580ab2`
- Approved learner video SHA-256: `1eeaa68bde9529da7e2aeb8ccbd36b4dd41c56f408e191792765230b9c861775`
- Approved learner VTT SHA-256: `6dee645eafea79649d17711c589a84acbe45a478b7a5994f718ccbbc6297492e`
- Fixed desktop candidate SHA-256: `7a5f5231cd999dd0eb8a1eaf83e8500b8b3c6fd0ea2d1cb15b6f0437a50bdca8`
- Fixed mobile candidate SHA-256: `6a1f9c0e8eb39c8af5ae5f4695b7cc21dc20c39395fa66b99b6ed8b626f75fac`
- Candidate VTT SHA-256, both layouts: `f6d416350ebe3ced3a0ec0c2ea243017dc881e0182244c228257ad2ac4677f52`

Desktop Small and Medium captions use the existing cue-driven band only during audited L01-02 (`34.585 ≤ t < 74.197`). At 52 seconds, the exact VTT cue is outside the learner video. Adjacent L01 desktop scenes keep native captions; mobile and Large keep the existing external-band path. The video, VTT, audio, art, geometry, controls, themes, learner data, and bindings were not edited.

## Checks and walkthroughs

- `node scripts/qa/verify-l01-caption-clearance.mjs` — PASS: 66 learner states and six fixed-candidate states. [`receipt.json`](receipt.json) covers eight L01 scene boundaries/midpoints at 1280×720 and 390×844, L01-02 transitions, cue gaps, S/M/L, paused off/on, exact source cues, band geometry, native controls, source hashes, and no added width.
- `node scripts/qa/record-l01-caption-clearance.mjs` — PASS: 26 saved states and four FFmpeg-decoded MP4s; [`walkthrough-state.json`](walkthrough-state.json) records the route, commit, time, cue, mode, band, and controls for each step.
- Focused Vitest suite — 78 passed (caption control, Agentified hero and workshop, Accelerated plan). ESLint on changed TSX, Node syntax checks on QA scripts, and `git diff --check` passed.

- [Learner desktop walkthrough](L01-learner-1280-97ca5bf242.mp4)
- [Learner 390 px walkthrough](L01-learner-390-97ca5bf242.mp4)
- [Fixed candidate desktop walkthrough](L01-candidate-desktop-97ca5bf242.mp4)
- [Fixed candidate mobile walkthrough](L01-candidate-mobile-97ca5bf242.mp4)

The learner's approved source art places “Prepare one brief” close to the native control overlay in paused screenshots. That pre-existing control proximity is visible in `L01-02-1280-M-on.png` and `L01-02-390-M-on.png`; the caption itself is cleared. The fixed-padding candidate has more readable label spacing in `candidate-desktop-M-on.png` and `candidate-mobile-M-on.png`, but its media remains unbound. No new obstruction, geometry movement, missing or duplicate caption, or source drift was observed in this check.

## Integration boundary

PR #1290 owns the lesson-order padding pass and any later media-binding decision. PR #1293 remains draft for captain review. PR #1294 remains stacked downstream and touches the same hero component. No media bind, merge, manual deployment, provider action, spending, publication, or release is part of this packet.
