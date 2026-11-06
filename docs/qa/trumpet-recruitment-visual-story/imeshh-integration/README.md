# Milestone trumpet integration review

## Binding and scope

- Product commit: `5ada98cd761ee2df26c268ae400f3575f8f1032d` on `codex/trumpet-recruitment-visual-story` (draft PR #1215).
- Exact local route: `http://localhost:3115/work/trumpet-trainer/recruitment?rev=5ada98cd761ee2df26c268ae400f3575f8f1032d`.
- Route remains an inactive, adult-only, noindex recruitment review. No contact collection, posting, or provider action is part of this change.
- The local iMeshh Blender ZIP is the verified licensed source. Its SHA-256 is `5d7d57de0da0cd1defe1c2b61c48bf9d66c73b0d698644bb0715ba75b92526fa`. The source ZIP and its meshes, textures, and Blender project are excluded from Git and the browser. The public media contains one flat poster and six H.264 renders only.

## Review files

- `desktop-walkthrough.mp4`: 1280 × 900, all six direct selections, previous, and replay.
- `mobile-walkthrough.mp4`: 360 × 800, the same interaction path.
- `desktop-step-03.png` and `mobile-step-03.png`: rendered milestone 3 states.

The first recording attempt was discarded because a concurrent build replaced the local dev server's generated assets. These files were recaptured after restarting the exact-commit server. The final browser run returned no page errors or horizontal overflow at either width.

## Validation

- `npx vitest run components/TrumpetRecruitmentTimeline.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx`: 12 passed.
- `npx eslint components/TrumpetRecruitmentTimeline.tsx components/TrumpetRecruitmentTimeline.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx`: passed.
- `python3 scripts/qa/check-imeshh-trumpet-license.py --asset-zip /Users/vambahsillah/Downloads/Decorations_Instruments_Trumpet_01_Blender.zip`: passed source hash and candidate-path/media checks.
- Headless Chromium at 360, 768, and 1280 px: all six cards selected their matching clips; previous, replay, and End key worked; no page errors or horizontal overflow. At 360 px with reduced motion, selection worked without video or replay.
- `npm run build`: compiled, then Node ran out of memory during repository-wide type checking at the default 4 GB heap.
- `NODE_OPTIONS=--max-old-space-size=8192 N8N_DISABLE_OUTBOUND=true npm run build`: passed full compile, lint/type check, and static route generation. Existing unrelated lint warnings remain.

## Captain review gate

Inspect the two MP4s and the exact local route. Confirm the motion reads as one restrained, milestone-specific gesture per selection, without a black media rectangle, clipped controls, or layout shift. This lane stops at validated draft PR; Captain owns further review, Human QA routing, merge, and deployment.
