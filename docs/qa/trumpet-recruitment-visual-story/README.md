# Trumpet recruitment persona-sheet review

UI commit: `1897ab60ddc65490d9ce0972e6efca1924c92396`. Exact production-build localhost route: `http://localhost:3018/work/trumpet-trainer/recruitment?revision=1897ab60ddc65490d9ce0972e6efca1924c92396&qa=persona-arc-type#audiences`.

The 26 PNG frames were captured in the Codex in-app browser from that build with placeholder public Supabase values and outbound n8n disabled. The orange `DEV ENVIRONMENT` strip identifies the local build. Frames 01–02 and 19–20 show the social-carousel endpoints at desktop and phone widths. Frames 03–18 show each of the four selected fictional persona sheets with the contact path open at 1280, 1062, 768, and 360 px. Frames 21–22 show actual phone drags that advance and restore the selection. Frames 23–26 capture intermediate forward and reverse fan arcs on desktop and phone. The ordered frames form a stitched MP4 walkthrough of browser states, including sampled motion states; this is not a continuous screen recording. No customer, child, recipient, or private reply data appears.

Each sheet retains its fictional first name and role, quote, Goal, Friction, Current behavior, Product proof, and secondary Contact path. These are hypothesis-based composites, not interview excerpts or validated customer findings. `persona-source-map.md` records synthetic image lineage and copy boundaries. Typography and gaps in the lower half are larger. The shared card is 720 px tall on desktop/tablet, with a 50/50 image/profile split; on phone it is 822 px tall with a 40/60 split. Images remain cover-fit without letterboxing.

The outgoing front sheet now follows a shallow direction-correct arc on arrow, dot, or deliberate swipe selection. Drag rotation tracks horizontal movement. Below-threshold gestures return the sheet, vertical movement leaves selection alone, and reduced-motion preference skips the arc. The settled fan depth, selected semantics, and contact disclosures remain intact. The interaction tests cover forward/reverse arrows, dot direction, swipe, return, vertical movement, final depth, and reduced motion.

`geometry-audit.json` records 16 open-contact capture states and 16 responsive checks. At the exact build's 360 × 900, 768 × 900, 1062 × 900, and 1280 × 900 test widths, the open contact line remained inside its copy region, copy had no scroll overflow, and document `scrollWidth` equaled `clientWidth`. The tightest phone copy clearance was 24 px. At 768 px, the visible fan stayed 60 px or more from the left edge. Phone captures used 360 × 1080 so the entire taller sheet is legible in one frame; the 360 × 900 fit check is recorded separately.

`build-walkthrough.sh` assembles the 26 frames into `trumpet-recruitment-persona-sheets-1897ab60.mp4` and the phone frames 15–22 and 25–26 into `trumpet-recruitment-persona-sheets-mobile-1897ab60.mp4`. Both are H.264 at 24 fps. The wide video is 1280 × 900, 988 frames, 41.17 seconds; the phone video is 360 × 1080, 380 frames, 15.83 seconds. Both passed full FFmpeg decode. The earlier `94caae6b` MP4s are retained as prior-iteration evidence and are superseded for this review.

Validation:

- `npx vitest run app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentPersonas.test.tsx components/TrumpetRecruitmentSocialCarousel.test.tsx components/TrumpetRecruitmentMessages.test.tsx components/TrumpetRecruitmentCopy.test.tsx` — 19 passed.
- Scoped ESLint and `git diff --check` — passed.
- `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed in isolation; existing unrelated lint warnings remain.

The route remains inactive, unlinked, and noindex. No send, schedule, provider call, data write, merge, or production deployment occurred. `capture-manifest.json` records hashes and resolves the QA commit with `git log -1 --format=%H -- docs/qa/trumpet-recruitment-visual-story`.
