# Agentified L01 learner binding QA

Review code commit: `d55e6f7895f431fd4b901a5f0ec3d7265d021841`

Guest route: `http://127.0.0.1:3159/agentified/learningplan?lesson=L01&revision=d55e6f7895f431fd4b901a5f0ec3d7265d021841`

Member route after sign-in: same URL. The member path was covered with synthetic session and API fixtures; no live member account or learner data was used.

The desktop and mobile MP4s show L01 video visibility and playback, read-along transcript, the L05 locked-video state, Operating File navigation, and the return to L01. PNGs show 1440, 820, and 390 pixel rendered layouts. The capture script blocked outbound HTTPS requests and used fresh guest browser contexts. No learner response was entered or submitted.

The corrected composite SHA-256 is `34737c643f7928fe3a7e3e23bcd33d8e4715c0052bac532e5fd43c1e689b25e5`. Rendered-frame regression checks verify that the teaching plate remains visible after the opening presenter, before the closing presenter, and through the final evidence card.

Validation: focused Vitest suite (18 tests), `NODE_OPTIONS=--max-old-space-size=8192 npm run build`, and `node scripts/qa/record-agentified-l01-learning-plan.mjs http://127.0.0.1:3159 d55e6f7895f431fd4b901a5f0ec3d7265d021841`. Both MP4s were confirmed as H.264 and visually inspected.
