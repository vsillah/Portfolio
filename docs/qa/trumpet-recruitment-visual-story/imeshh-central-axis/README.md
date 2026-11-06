# Trumpet central-axis timeline review

## Decision and binding

Human QA approved the transparent media, alternating chronology, and numbered timeline in draft PR #1215, then asked that the rail itself align beneath the trumpet's long physical body and bell stem. Product commit: `9c8964a84fd17a03efecdb80c20608e7085522f2` on `codex/trumpet-recruitment-visual-story`.

Exact local route: `http://localhost:3115/work/trumpet-trainer/recruitment?rev=9c8964a84fd17a03efecdb80c20608e7085522f2`.

The continuous rail now sits at 37.5% of the rendered trumpet stage width, aligned with the main tube and bell stem. The timeline SVG is behind the transparent poster and video, so brass covers the rail where they overlap. Each branch begins at that hidden axis and emerges left or right toward its card. Numbered nodes sit on the visible branch ends outside the trumpet silhouette. On desktop and tablet, steps 1–6 remain strictly descending and alternate left/right. On mobile, cards and nodes stack to the right in the same 1–6 order. Completed spine and branch segments still accumulate through the selected step; future segments remain subdued.

The previously approved RGBA poster, six VP9 alpha clips and gestures, transparent playback probe and fallback, controls, focus and step semantics, reduced-motion behavior, inactive adult-only noindex route, and source-exclusion safeguards remain unchanged. This refinement adds no provider, data, contact, publishing, or purchase action.

## Review files

- `desktop-walkthrough.mp4`: 1280 × 900 exact-product-commit capture of six selections, previous, and replay.
- `mobile-walkthrough.mp4`: 360 × 800 capture of the same path.
- `initial-360.png`, `initial-768.png`, `initial-1280.png`: transparent trumpet with the rail aligned beneath its main tube and numbered branch ends visible.
- `progress-360.png`, `progress-768.png`, `progress-1280.png`: step 4 and cumulative progress.

Both MP4s are privacy-safe H.264 screen recordings, fully decoded without errors. The integrated in-app browser was unavailable in this development chat, so headless Chromium captured the exact local route. No customer or child data, account detail, secret, or licensed source asset appears.

## Validation

- `npx vitest run components/TrumpetRecruitmentTimeline.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx`: 17 passed, including stems originating at the common spine, ordered nodes, cumulative progress, alpha fallback, and reduced motion.
- `npx eslint components/TrumpetRecruitmentTimeline.tsx components/TrumpetRecruitmentTimeline.test.tsx`: passed.
- `python3 scripts/qa/check-imeshh-trumpet-license.py --asset-zip <local licensed ZIP>`: passed source hash, Git candidate-path source exclusion, RGBA poster, VP9 alpha, frame counts, duration, and decoded transparent corners.
- `NODE_OPTIONS=--max-old-space-size=8192 N8N_DISABLE_OUTBOUND=true npm run build`: passed compile, type check, and static generation; existing unrelated lint warnings remain.
- Exact-commit Chromium at 360, 768, and 1280 px: rail x-coordinate equaled 37.5% of stage width; SVG layer 1 sat beneath transparent media layer 2; all stems started on that x-coordinate; nodes remained outside the silhouette in the intended direction; no horizontal overflow. All six alpha clips, previous/replay/End, reduced motion, and Safari-style static-poster fallback passed without page errors.
- Exact-commit stills showed strictly descending card centers and step 4 reaching branches 1–4 only. Both walkthrough MP4s decoded fully and were inspected at desktop/mobile midpoints.

## Captain gate

Review both MP4s, responsive stills, and the exact route. Reject if the rail appears beside the object instead of beneath the main tube, brass fails to occlude the rail where expected, a number is hidden, a branch appears disconnected, progress skips a step, focus or controls fail, or mobile overflows. Captain owns in-app browser and any native Safari review, Human QA routing, merge, and deployment. Keep PR #1215 draft until review passes.
