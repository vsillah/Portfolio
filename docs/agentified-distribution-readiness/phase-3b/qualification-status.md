# Phase 3B bounded qualification status

Base: `9f31a4db904b3cf1b4e097191a3df32f13e8f8c9`. Branch: `codex/agentified-phase3b-provider-free-normalization`. Draft PR #1290 remains a captain **HOLD**, not a Human QA or release candidate.

## Contextual review stop

The next broader visual sweep found an unreadable mobile plate at L05-04, 01:30, on the 390×844 learner route. The 292×164 video makes the approved plate's detailed Open Brain/Harness labels too small to read. See `mobile-readability-stop.md`, the exact-route screenshot and MP4. This is the requested stop condition. The complete 104 eligible positions (128 historical positions minus excluded L02–L04) are **not** qualified, and consolidated full-scope walkthroughs and versioned spoken transcripts are not claimed. Stop for a separate scoped correction before resuming Phase 3B.

## L01: corrected learner metadata and end-screen UI

The existing illustrated MP4 has 9,457 video frames at 25 fps (378.280 s) and audio through 378.285 s. Its earlier declared 378.059 s was 0.226 s short. The illustrated binding uses the container duration, while the historic source-media receipt remains lineage. The exact-hash L01 end-screen binding begins at the final VTT cue end, 359.645 s, shows progress 1 of 16, and names L02 next. A narrow source-identity exception in `AgentifiedWorkshop.tsx` accepts only this exact duration correction; it does not admit a different video or caption asset.

Focused binding/component/workshop tests pass. The caption helper now follows the active native text-track mode through on→off→on, paused, and ended states. The three-lesson regression checks cover L01, L10, and L16. Six exact-route browser walkthrough MP4s (1280×720 and 390×844 for each lesson) show controls, text-track on/off, end seek, replay, and reversible manual completion in isolated guest contexts at code commit `e5cce9a7a`. The browser script changes `textTracks[0].mode` to exercise the native track state; it does not record a person using the browser's native captions menu. The screenshots and MP4s are in `agentified/workshop/phase-3b-review/browser-walkthrough/`. The localhost browser used placeholder Supabase values and disabled outbound n8n calls; no live data was written.

The repository-wide `tsc --noEmit --pretty false` check still exits 2 with 67 lines of errors outside the changed Agentified files, including existing test typings, missing `@electric-sql/pglite`, and missing generated knowledge content. The changed Agentified files appear in none of those diagnostics. The focused tests and sixteen-lesson binding verifier pass; the broad typecheck remains a captain integration gate.

## L10 and L16: review-only media

The prepared Phase 3A L10 cue would end at 03:04.360, before the acoustic/source word timing ends “condition” at 03:05.000. A bounded candidate instead leaves that cue ending at 03:05.000 and starts “Mark it unapproved” at 03:05.520. The complete 02:46–03:16 passage was processed with a local word-level speech model and compared to the native timing receipt and canonical VTT. Video and audio elementary streams are byte-identical in the caption-only remux. Human auditory confirmation remains pending because the model could not directly listen to the playback. See `l10-acoustic-receipt.json`. The corrected MP4/VTT are unbound review files.

L16's approved closing-card contract explicitly overlays the final presenter passage. The current video ends at 266.680 s, while audio continues to 267.309 s and captions to 267.222 s. A provider-free candidate preserves all 6,667 original video frames and original audio packets byte for byte, then displays the approved presenter-free `L16-08` card from the existing picture cutoff through 275.320 s. That yields 8.098 s of card after the last cue and 8.011 s without audio after the original audio ends. The transition and final card frames were visually inspected; no presenter frame was frozen, interpolated, regenerated or changed. See `l16-rest-receipt.json`. The MP4 remains unbound.

`source-map-v1.json` verifies immutable script, original composite and caption bytes for L01 and L05–L16. Old transcript digests remain unattributed lineage. No final spoken-word transcript is claimed. Fourteen desktop/mobile contextual media MP4s cover representative setup, teaching, guided work, ending and adjacent continuity with optional captions; every file decoded cleanly. They show media content rather than browser controls. The existing illustration validator passes 128 hashed scenes and unchanged baseline audio/caption streams, but contextual source-faithful visual/caption review across all scenes and full transcript attribution remain pending.

No provider contact, generation, spend, L02–L04 change, L10/L16 learner binding, production/learner data mutation, deployment, publication, or release occurred. Do not request Human QA, mark Phase 3 complete, or merge PR #1290 from this packet.

## Reproduction

`python3 docs/agentified-distribution-readiness/phase-3b/build_source_map.py`

`bash docs/agentified-distribution-readiness/phase-3b/remux_l10_caption.sh`

`bash docs/agentified-distribution-readiness/phase-3b/render_l16_rest.sh`

`bash docs/agentified-distribution-readiness/phase-3b/render_context_clips.sh`

`node agentified/workshop/presentation-illustration-audit/validate.mjs`

`./node_modules/.bin/vitest run lib/agentified-end-screens.test.ts app/agentified/AgentifiedLessonHero.test.tsx app/agentified/AgentifiedWorkshop.test.tsx`

`node docs/agentified-distribution-readiness/phase-3b/record_browser_walkthrough.cjs e5cce9a7a`

Next gate: captain listens to the exact L10 contextual clip and reviews the L16 card handoff; complete thirteen-lesson source-faithful QA and transcript provenance before any Human QA handoff. The six browser MP4s are captain review evidence, not a Human QA request.
