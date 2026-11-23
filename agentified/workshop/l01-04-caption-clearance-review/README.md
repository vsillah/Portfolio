# L01-04 caption clearance review

Code commit: `0b53f3436fbba0e162f5f9413b6cb773b2bd74ad`. Fixed-padding candidate: exact PR #1290 head `e3462078666d0f99596d14a3c4b15649ffa8f8b7`. The candidate MP4/VTT bytes are copied unchanged into `candidate/` for standalone review and are not bound to the learner route.

## Source binding and scope

- Learner route: `http://127.0.0.1:3137/agentified/learningplan?lesson=L01&rev=0b53f3436fbba0e162f5f9413b6cb773b2bd74ad`
- Approved learner video SHA-256: `1eeaa68bde9529da7e2aeb8ccbd36b4dd41c56f408e191792765230b9c861775`
- Approved learner VTT SHA-256: `6dee645eafea79649d17711c589a84acbe45a478b7a5994f718ccbbc6297492e`
- Fixed desktop candidate SHA-256: `1dd7218a67663a948a5cff3caeda38ae9a0656a535dbe8b71f6a8bce4676ee4c`
- Fixed mobile candidate SHA-256: `3dc7b04098a108ebea68e547a7cd6bec7ed59cf14fe03f4e0f2fe98a7a01427e`
- Candidate VTT SHA-256, both layouts: `c0d93b54dd99916f304464c3e2c97b656b11bd5b2a19af9fe8baea1fa2326e41`

Desktop Small and Medium captions use the existing cue-driven band only during audited L01-04 (`114.358 ≤ t < 150.501`). At 132 seconds, the active source cue is below the learner video. Adjacent L01-03 and L01-05 desktop scenes keep native captions; mobile and Large keep the existing external band path. The video, VTT, audio, art, geometry, controls, Aa behavior, themes, learner data, and bindings were not edited.

## Checks and walkthroughs

- `node scripts/qa/verify-l01-04-caption-clearance.mjs` — PASS at the code commit: 66 learner states and six fixed-candidate states. [`receipt.json`](receipt.json) covers all eight L01 scene boundaries and midpoints at 1280×720 and 390×844, scene transitions, cue gaps, S/M/L, paused off/on, exact cue text/timing, source hashes, band geometry, controls, and no added width.
- `node scripts/qa/record-l01-04-caption-clearance.mjs` — PASS: 26 states and four FFmpeg-decoded MP4s. [`walkthrough-state.json`](walkthrough-state.json) records route, commit, time, cue, track mode, band, and controls at each step.
- Focused Vitest suite — 79 passed (caption control, Agentified hero and workshop, Accelerated plan). ESLint on changed TSX, Node syntax checks on QA scripts, and `git diff --check` passed.

- [Learner desktop walkthrough](L01-learner-1280-0b53f3436f.mp4)
- [Learner 390 px walkthrough](L01-learner-390-0b53f3436f.mp4)
- [Fixed candidate desktop walkthrough](L01-candidate-desktop-0b53f3436f.mp4)
- [Fixed candidate mobile walkthrough](L01-candidate-mobile-0b53f3436f.mp4)

The learner's approved source art places its lower labels close to the native control overlay in paused screenshots. The control overlay's existing proximity to “Human gate” is visible in `L01-04-1280-M-on.png`; the caption itself is cleared. The fixed-padding candidate shows both labels clear in `candidate-desktop-M-on.png` and `candidate-mobile-M-on.png`. Its media remains review-only. No new caption obstruction, missing or duplicate cue, video movement, or source drift was observed.

## Integration boundary

PR #1290 owns the lesson-order padding pass and any later media-binding decision. PR #1293 remains draft for captain review. PR #1294 remains stacked downstream and touches the same hero component. No media bind, merge, manual deployment, provider action, spending, publication, or release is part of this packet.
