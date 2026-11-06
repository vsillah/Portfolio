# Transparent trumpet and chronological spine review

Historical checkpoint: Human QA approved the transparent media, alternating chronology, and continuous numbered timeline, then requested that its rail move beneath the trumpet's physical axis. The [central-axis review](../imeshh-central-axis/README.md) is the current target.

## Decision and binding

Human QA requested three corrections to draft PR #1215: remove the opaque navy media rectangle, make alternating 1–6 chronology unmistakable, and connect the milestones through one directional trumpet-centered timeline. Product commit: `9ceb54359eef833ccf4af258ad8968a36aaff367` on `codex/trumpet-recruitment-visual-story`.

Exact local route: `http://localhost:3115/work/trumpet-trainer/recruitment?rev=9ceb54359eef833ccf4af258ad8968a36aaff367`.

The upright trumpet floats on the page through an RGBA poster and six transparent VP9 clips. The old opaque H.264 application clips have been removed. One continuous vertical spine runs beside the trumpet body, with a downward end arrow, six numbered nodes, and branches to the cards. At 768 and 1280 px, cards alternate left, right, left, right, left, right with strictly descending centers. At 360 px, cards stack to the right in the same 1–6 order. Selecting step N illuminates the spine and branches through N; later segments remain subdued. The SVG timeline is decorative to assistive technology, while each card retains its accessible name, focus, pressed state, and active-step semantics.

## Alpha and fallback behavior

- The local Blender renderer emits RGBA frames from the exact licensed archive. FFmpeg encodes transparent VP9 WebM clips with `ALPHA_MODE=1`, 800 × 800, 24 fps, 24 frames for steps 1–5 and 36 frames for step 6. The poster remains a transparent 800 × 800 PNG. Only rendered output is committed; no iMeshh source mesh, texture, or archive is included.
- Chromium playback was verified on the exact local route. The video starts hidden. An initial-frame canvas sample must decode the transparent corner before the video becomes visible; opaque decoding, playback failure, or canvas failure leaves the poster visible with the plan selectable.
- Safari is deliberately limited to the transparent poster because this pipeline has no verified Safari alpha video codec. The native Safari video path was not claimed or tested. Reduced-motion users also keep the poster. This preserves the full timeline and controls without an opaque fallback rectangle.

## Review files

- `desktop-walkthrough.mp4`: 1280 × 900 exact-product-commit capture of six selections, previous, and replay.
- `mobile-walkthrough.mp4`: 360 × 800 capture of the same path.
- `initial-360.png`, `initial-768.png`, `initial-1280.png`: transparent starting state and ordered spine.
- `progress-360.png`, `progress-768.png`, `progress-1280.png`: step 4 with completed and future timeline segments.

The MP4s are privacy-safe screen recordings, H.264 encoded for Codex review, and fully decoded without errors. The integrated in-app browser was unavailable in this development chat, so headless Chromium captured the exact local route. No customer or child data, account detail, secret, or licensed source asset appears.

## Validation

- `npx vitest run components/TrumpetRecruitmentTimeline.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx`: 17 passed, including alpha acceptance and opaque failure, Safari-style poster fallback, continuous numbered spine, progress, mobile order, and reduced motion.
- `npx eslint components/TrumpetRecruitmentTimeline.tsx components/TrumpetRecruitmentTimeline.test.tsx`: passed.
- `python3 -m py_compile scripts/render_imeshh_repaired_proof.py scripts/qa/check-imeshh-trumpet-license.py`: passed.
- `python3 scripts/qa/check-imeshh-trumpet-license.py --asset-zip <local licensed ZIP>`: passed archive hash, Git source exclusion, RGBA poster check, VP9 alpha tags, decoded transparent corners, frame counts, and duration.
- `NODE_OPTIONS=--max-old-space-size=8192 N8N_DISABLE_OUTBOUND=true npm run build`: passed compile, type check, and static generation; existing unrelated lint warnings remain.
- `ffprobe` inspection: all six clips are VP9, 800 × 800, `ALPHA_MODE=1`; first five have 24 frames / 1 s, sixth has 36 frames / 1.5 s. FFmpeg decoded the first clip with transparent and opaque pixels.
- Exact-commit Chromium at 360, 768, and 1280 px: all six clips loaded and passed the browser alpha probe, previous/replay/End worked, no page errors or horizontal overflow, explicit left/right alternation and descending centers, continuous spine and numbered nodes, cumulative progress. Reduced motion and a simulated Safari vendor both retained the static poster.

## Captain gate

Review both MP4s, responsive stills, and the exact route. Reject if any opaque rectangle or alpha halo appears, the chronology or direction is unclear, the spine visually detaches from the trumpet, a line obscures anatomy, progress skips a milestone, focus or controls fail, or mobile overflows. Captain owns in-app browser verification, native Safari judgment where available, Human QA routing, merge, and deployment. Keep PR #1215 draft until review passes. No provider action, data mutation, outreach, posting, purchase, merge, or deployment occurred in this lane.
