# L06-03 caption clearance review

This packet records the scene-bound caption correction at code commit `51747cb7d53f5be320a04896e9c6a648f0803d6e`. It also contains the exact review-only fixed-padding candidate bytes from PR #1290 head `519918b9df23ae012d5c20c700ffb8a696775afb`. The candidate remains separate from the learner media binding.

## Scope and source binding

- Learner route: `http://127.0.0.1:3137/agentified/learningplan?lesson=L06&rev=51747cb7d53f5be320a04896e9c6a648f0803d6e`
- Approved learner video SHA-256: `163e01e6eb8f1a014b7155b40063bc2b6fa3546fc6bc4329579775581e6f9ef3`
- Approved learner VTT SHA-256: `018418cc1d4bf2333ed6525f1926b8b052f57677a136976e42c80c8f703c69ba`
- Fixed desktop candidate SHA-256: `fe43edac9b88b6d381de36e81cdadd6ae558fa74b6982d502df6f58ee85b4f80`
- Fixed mobile candidate SHA-256: `475535fe5c92f87202cfc78e5b732780eb7a831c2b6594ea3378c3383460ad59`
- Candidate VTT SHA-256, both layouts: `2eb78df15dd80e458cb3788f35d196c84aeeb06cb8793663194bd2eac0c9f789`

The learner change selects the existing cue-driven external caption band on desktop only during L06-03 (`65.532 ≤ t < 97.482`). At 77 seconds, the “Prepare” and “Human gate” labels remain visible while the exact active VTT cue appears below the video. Mobile keeps its existing band behavior. Desktop neighboring scenes keep native captions. The video, VTT, audio, artwork, geometry, controls, and binding were not edited.

## Verification

- `node scripts/qa/verify-l06-caption-clearance.mjs` — PASS: 64 learner states and six fixed-candidate states. The receipt is [`receipt.json`](receipt.json). It covers all eight L06 scenes at desktop and 390 px, scene boundaries, paused state, caption S/M/L, off/on, cue gaps, source-cue equality, band geometry, and native controls.
- `node scripts/qa/record-l06-caption-clearance.mjs` — PASS: 26 walkthrough states and four decoded MP4s. The state trace is [`walkthrough-state.json`](walkthrough-state.json).
- Focused Vitest suite — 77 tests passed (caption control, Agentified hero and workshop, Accelerated plan). ESLint on changed TSX, Node syntax checks on QA scripts, and `git diff --check` passed before the code commit.

## Walkthroughs

- [Learner desktop](L06-learner-1280-51747cb7d5.mp4)
- [Learner 390 px](L06-learner-390-51747cb7d5.mp4)
- [Fixed candidate desktop](L06-candidate-desktop-51747cb7d5.mp4)
- [Fixed candidate mobile](L06-candidate-mobile-51747cb7d5.mp4)

The learner walkthroughs show adjacent scenes, L06-03 sizes, captions off and restored, and the cue gap. The candidate walkthroughs show the exact PR #1290 clip with the same caption controls in a standalone review page. Screenshots named `L06-03-*` and `candidate-*` show each size and off/on state.

## Integration boundary

PR #1290 still owns the review-only padding candidate and any future media-binding decision. The approved learner video still contains its prior headline presentation. PR #1293 remains draft for captain review. PR #1294 is stacked downstream and touches the same hero component; reconcile it after this PR head. No learner media bind, merge, deployment, provider action, spending, publication, or release is part of this packet.
