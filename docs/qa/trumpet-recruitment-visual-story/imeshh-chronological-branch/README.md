# Chronological trumpet branch review

Historical checkpoint: Human QA requested transparent motion and a continuous numbered spine after this packet. The [transparent spine review](../imeshh-transparent-spine/README.md) is the current target.

## Decision and binding

Human QA rejected the preceding U-shaped rail because it placed steps 4–6 on an upward return path. This packet reviews the corrected six-step chronology on draft PR #1215. Product commit: `bfabcbfe1e6d8bb1a0ae776954a6fb9980394c73` on `codex/trumpet-recruitment-visual-story`.

Exact local route: `http://localhost:3115/work/trumpet-trainer/recruitment?rev=bfabcbfe1e6d8bb1a0ae776954a6fb9980394c73`.

Steps 1–6 descend from top to bottom. At desktop and tablet widths the cards alternate left and right of the upright trumpet; short stems join each card to a node on or immediately beside the instrument. At mobile width the cards stack to its right, keeping the same top-down order. Selecting a step lights its branch and every preceding branch in gold, leaving later branches subdued. The trumpet is the visual spine. Decorative SVG branches are hidden from assistive technology; each card retains its accessible step label, focus treatment, pressed state, and `aria-current="step"` on the active milestone. Reduced-motion selection also updates branch progress.

The previously approved vertical source media, six gesture clips, timing, navy stage, source-exclusion safeguards, and inactive, adult-only, noindex recruitment behavior remain in place. This correction introduces no provider, data, contact, publishing, or purchase action.

## Review files

- `desktop-walkthrough.mp4`: 1280 × 900 capture of all six selections, previous, and replay.
- `mobile-walkthrough.mp4`: 360 × 800 capture of the same path.
- `initial-360.png`, `initial-768.png`, `initial-1280.png`: starting state and six descending milestones.
- `progress-360.png`, `progress-768.png`, `progress-1280.png`: step 4 with branches 1–4 gold and 5–6 subdued.

Both MP4s are H.264, decoded fully without errors, and privacy-safe. The integrated in-app browser was unavailable in this chat, so headless Chromium recorded the exact local route. No customer or child data, account detail, secret, or licensed source asset appears.

## Validation

- `npx vitest run components/TrumpetRecruitmentTimeline.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx`: 14 passed.
- `npx eslint components/TrumpetRecruitmentTimeline.tsx components/TrumpetRecruitmentTimeline.test.tsx`: passed.
- `python3 scripts/qa/check-imeshh-trumpet-license.py --asset-zip <local licensed ZIP>`: passed source hash, Git candidate-path exclusion, PNG, and one-stream MP4 checks.
- `NODE_OPTIONS=--max-old-space-size=8192 N8N_DISABLE_OUTBOUND=true npm run build`: passed compile, type check, and static generation; existing unrelated lint warnings remain.
- Headless Chromium at 360, 768, and 1280 px: all six selections loaded and played matching clips; previous, replay, and End key worked; no page errors or horizontal overflow. Reduced-motion selection worked without video or replay.
- Rendered card center y-coordinates increased from step 1 to step 6 at all three widths. Step 4 showed exactly four reached branches. The mobile nodes stay beside the trumpet without obscuring valve anatomy.

## Captain gate

Review both MP4s, responsive stills, and the exact local route. Reject if the order is ambiguous, a branch disconnects from its card or trumpet, active progress skips a milestone, instrument anatomy is obscured, focus is hidden, or mobile overflows. Captain owns further review, Human QA routing, merge, and deployment. Keep PR #1215 draft until review passes.
