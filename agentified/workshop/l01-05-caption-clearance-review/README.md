# L01-05 caption clearance review

Code commit: `85cadf493669e91245ce3d9eafa75df759081304`. Fixed-padding candidate: exact PR #1290 head `ff17e8a0e4ad6e38f2bfa62376fd8d63e2940496`. Candidate MP4/VTT bytes are copied unchanged into `candidate/` for standalone review and are not bound to the learner route.

## Source binding and scope

- Learner route: `http://127.0.0.1:3137/agentified/learningplan?lesson=L01&rev=85cadf493669e91245ce3d9eafa75df759081304`
- Approved learner video SHA-256: `1eeaa68bde9529da7e2aeb8ccbd36b4dd41c56f408e191792765230b9c861775`
- Approved learner VTT SHA-256: `6dee645eafea79649d17711c589a84acbe45a478b7a5994f718ccbbc6297492e`
- Fixed desktop candidate SHA-256: `5ec18b955e298319b1592809147642196f657cbf37f0c684fd80683c4ac4cd25`
- Fixed mobile candidate SHA-256: `5ec614c3bc409b47c9df362409d414b7ae19765b812ea594be8ea2ebb1016157`
- Candidate VTT SHA-256, both layouts: `175353093eb63a7b21d1071597d63e03f5ae63a5f62c157d59ef4a83799bd597`

Desktop Small and Medium captions use the existing cue-driven band during audited L01-05 (`150.501 ≤ t < 183.059`). At about 162.78 seconds, the active source cue is below the learner video and does not cover “Source missing.” L01-04 keeps its preceding scene-bound band; L01-06 returns to native desktop captions. Mobile and Large keep their existing external-band path. The learner video, VTT, audio, art, geometry, controls, Aa behavior, themes, data, and bindings were not edited.

## Checks and walkthroughs

- `node scripts/qa/verify-l01-05-caption-clearance.mjs` — PASS at the code commit: 66 learner states and six fixed-candidate states. [`receipt.json`](receipt.json) covers all eight L01 scene boundaries and midpoints at 1280×720 and 390×844, transitions, cue gaps, S/M/L, paused off/on, exact cue text/timing, source hashes, band geometry, controls, and no added width.
- `node scripts/qa/record-l01-05-caption-clearance.mjs` — PASS: 26 saved states and four FFmpeg-decoded MP4s. [`walkthrough-state.json`](walkthrough-state.json) records route, commit, time, cue, mode, band, and controls at each step. Both scripts wait for a real Aa interaction before seeking so hydration cannot produce a false initial mode.
- Focused Vitest suite — 80 passed (caption control, Agentified hero and workshop, Accelerated plan). ESLint on changed TSX, Node syntax checks on QA scripts, and `git diff --check` passed.

- [Learner desktop walkthrough](L01-learner-1280-85cadf4936.mp4)
- [Learner 390 px walkthrough](L01-learner-390-85cadf4936.mp4)
- [Fixed candidate desktop walkthrough](L01-candidate-desktop-85cadf4936.mp4)
- [Fixed candidate mobile walkthrough](L01-candidate-mobile-85cadf4936.mp4)

The approved learner source places its lower label near the native control overlay when paused; see `L01-05-1280-M-on.png`. The caption is clear of that label. The review-only fixed-padding candidate shows “Source missing” clear at desktop and mobile in `candidate-desktop-M-on.png` and `candidate-mobile-M-on.png`. No new caption obstruction, missing or duplicate cue, video movement, clipping, or source drift was observed.

## Integration boundary

PR #1290 owns the lesson-order padding pass and any later media-binding decision. PR #1293 remains draft for captain review. PR #1294 remains stacked downstream and touches the same hero component. No media bind, merge, manual deployment, provider action, spending, publication, or release is part of this packet.
