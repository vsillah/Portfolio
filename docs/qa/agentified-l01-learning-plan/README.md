# Agentified L01 learner binding QA

Review code commit: `3eeb882fd79f980a0dc6f4360a013ada47a196d0`

Guest route: `http://localhost:3217/agentified/learningplan?lesson=L01&revision=3eeb882fd79f980a0dc6f4360a013ada47a196d0`

Member route after sign-in: same URL. The member path was covered with synthetic session and API fixtures; no live member account or learner data was used.

The desktop and mobile MP4s show L01 video visibility and playback, read-along transcript, L02's locked video state, Operating File navigation, and the return to L01. PNGs show 1440, 820, and 390 pixel rendered layouts. The capture script blocked outbound HTTPS requests and used fresh guest browser contexts. No learner response was entered or submitted.

Validation: focused Vitest suite, `NODE_OPTIONS=--max-old-space-size=8192 MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build`, and `node scripts/qa/record-agentified-l01-learning-plan.mjs http://localhost:3217 3eeb882fd79f980a0dc6f4360a013ada47a196d0`. Both MP4s were confirmed as H.264 and visually inspected. TypeScript's repository-wide `tsc --noEmit` still reports existing errors outside the changed files.
