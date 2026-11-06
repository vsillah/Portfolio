# Connected milestone rail review

Historical checkpoint: Human QA rejected this U-border rail because it routed steps down one side and back up the other. The [chronological trumpet branch](../imeshh-chronological-branch/README.md) is the current review target. Preserve this packet only as evidence of the rejected treatment.

## Decision and binding

Human QA approved the vertical iMeshh trumpet at `e8be435a` but found its six cards visually disconnected. This packet reviews the timeline correction on draft PR #1215. Product commit: `7b731ffa675677e567d7464649ca2204000f009d` on `codex/trumpet-recruitment-visual-story`.

Exact local route: `http://localhost:3115/work/trumpet-trainer/recruitment?rev=7b731ffa675677e567d7464649ca2204000f009d`.

At desktop and tablet widths, steps 1–3 descend beside the left edge of the trumpet, and steps 4–6 ascend beside its right edge. A single restrained U-shaped rail joins the six nodes below and outside the stage. The selected milestone fills the path through its node; future segments remain subdued. At mobile width, the layout becomes one left rail beside six stacked cards in DOM order. The SVG rail and node markers are decorative to assistive technology; each button retains its accessible step label, focus treatment, pressed state, and `aria-current="step"` for the active milestone. The path also advances with reduced motion enabled.

The approved vertical poster, six gesture clips, timing, realistic anatomy, navy stage, source-exclusion safeguards, and inactive, adult-only, noindex recruitment behavior are unchanged. This correction introduces no provider, data, contact, publishing, or purchase action.

## Review files

- `desktop-walkthrough.mp4`: 1280 × 900 exact-product-commit capture of six selections, previous, and replay.
- `mobile-walkthrough.mp4`: 360 × 800 capture of the same path.
- `initial-360.png`, `initial-768.png`, `initial-1280.png`: subdued future path and first active node.
- `progress-360.png`, `progress-768.png`, `progress-1280.png`: active path at step 5 on mobile and step 4 on tablet/desktop.

Both MP4s are H.264, fully decoded without errors, and privacy-safe. The integrated in-app browser was unavailable in this chat, so headless Chromium recorded the exact local route. No customer or child data, account detail, secret, or licensed source asset appears.

## Validation

- `npx vitest run components/TrumpetRecruitmentTimeline.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx`: 14 passed, including six-node order, active progression, mobile rail, reduced-motion state, and existing interaction behavior.
- `npx eslint components/TrumpetRecruitmentTimeline.tsx components/TrumpetRecruitmentTimeline.test.tsx`: passed.
- `python3 scripts/qa/check-imeshh-trumpet-license.py --asset-zip <local licensed ZIP>`: passed source hash, Git candidate-path exclusion, PNG, and one-stream MP4 checks.
- `NODE_OPTIONS=--max-old-space-size=8192 N8N_DISABLE_OUTBOUND=true npm run build`: passed compile, type check, and static generation; existing unrelated lint warnings remain.
- Headless Chromium at 360, 768, and 1280 px: all six selections loaded matching clips; previous, replay, and End key worked; no page errors or horizontal overflow. Reduced-motion selection worked without video or replay.
- Rendered geometry: the three left nodes sit left of the stage, the three right nodes sit right of it, and the bridge stays below it at 768 and 1280 px. All six mobile nodes share one x-position.

## Captain gate

Review both MP4s, the responsive stills, and the exact local route. Reject if the path appears broken or ambiguous, a node disconnects from its card, the active path skips a milestone, the rail crosses the trumpet, focus is obscured, or mobile overflows. Captain owns further review, Human QA routing, merge, and deployment. Keep PR #1215 draft until the review passes.
