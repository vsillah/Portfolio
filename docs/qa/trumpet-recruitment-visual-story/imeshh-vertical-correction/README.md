# Vertical trumpet correction review

Historical checkpoint: Human QA approved the vertical trumpet but found the six cards visually disconnected. The [connected timeline rail](../imeshh-timeline-rail/README.md) is the current review target. Preserve this packet as evidence of the approved vertical instrument state.

## Decision and binding

Human QA accepted the six mechanical gestures in the prior `e9f3b774` checkpoint and rejected its diagonal framing. This packet reviews only the vertical orientation correction for draft PR #1215. The product commit is `b3f495fd20a76adfeadc030e0275eb78bfa4daa8` on `codex/trumpet-recruitment-visual-story`.

Exact local route: `http://localhost:3115/work/trumpet-trainer/recruitment?rev=b3f495fd20a76adfeadc030e0275eb78bfa4daa8`.

The trumpet now stands bell down and mouthpiece up in an 800 × 800 render and a square navy stage. The approved piston/slide sequence, 24 fps timing, 8 mm slide travel, 4 mm piston travel, source geometry and repair, direct selection, arrows, dots, replay, keyboard handling, reduced motion, and fallback behavior are unchanged. The recruitment route remains inactive, adult-only, and noindex.

## Review files

- `desktop-walkthrough.mp4`: 1280 × 900 exact-route capture; six direct selections, previous, and replay.
- `mobile-walkthrough.mp4`: 360 × 800 exact-route capture of the same path.
- `viewport-360.png`, `viewport-768.png`, `viewport-1280.png`: initial square stage and card layout.
- `desktop-step-03.png`, `mobile-step-03.png`: selected third milestone.

Both walkthroughs are H.264 MP4, fully decodable, and use only the synthetic review route. No customer or child data, account details, source asset, or secrets appear. The integrated in-app browser was unavailable in this chat; headless Chromium recorded the exact local route after restarting the dev server from the product commit.

## Validation

- Local Blender 5.1.2 render: six 800 × 800 clips, 24 frames each for steps 1–5 and 36 for step 6; one 800 × 800 RGBA poster. Source SHA-256 matched `5d7d57de0da0cd1defe1c2b61c48bf9d66c73b0d698644bb0715ba75b92526fa`. No mesh or Blender source was exported.
- `python3 scripts/qa/check-imeshh-trumpet-license.py --asset-zip <local licensed ZIP>`: passed source hash, candidate-path exclusion, PNG chunk, and one-stream video checks.
- `npx vitest run components/TrumpetRecruitmentTimeline.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx`: 12 passed.
- `npx eslint components/TrumpetRecruitmentTimeline.tsx components/TrumpetRecruitmentTimeline.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx`: passed.
- `python3 -m py_compile scripts/render_imeshh_repaired_proof.py scripts/qa/check-imeshh-trumpet-license.py`: passed.
- `NODE_OPTIONS=--max-old-space-size=8192 N8N_DISABLE_OUTBOUND=true npm run build`: passed compile, type check, and static generation; existing unrelated lint warnings remain.
- Headless Chromium at 360, 768, and 1280 px: all six cards loaded the matching clip; previous, replay, and End key worked; no page errors or horizontal overflow. At 360 px with reduced motion, card selection worked without video or replay.
- Exact stage sizes: 320 × 320 at 360 px, 520 × 520 at 768 px, and about 468 × 468 at 1280 px. Complete bell and mouthpiece were visually inspected at all three sizes.

## Captain gate

Review both walkthroughs and the exact local route. Confirm vertical orientation, anatomy, motion continuity, card spacing, and responsive framing. Stop if a slide seam opens, a valve assembly detaches, a clip switches back to diagonal framing, a black media rectangle appears, or a control clips or silently fails. This lane stops at draft PR; Captain owns further review, Human QA routing, merge, and deployment. No outreach, provider action, recruitment activation, data mutation, or production release occurred here.
