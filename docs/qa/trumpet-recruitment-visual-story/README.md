# Trumpet recruitment persona-sheet review

UI commit: `94caae6b0a159eb7aa68a5dbbcdb87debb896029`. Exact production-build localhost route: `http://localhost:3018/work/trumpet-trainer/recruitment?revision=94caae6b0a159eb7aa68a5dbbcdb87debb896029&qa=persona-sheets-controls`.

The 22 PNG frames were captured in the Codex in-app browser from that build with placeholder public Supabase values and outbound n8n disabled. The orange `DEV ENVIRONMENT` strip identifies the local build. Frames 01–02 show social slides at both endpoints. Frames 03–18 show each of four selected fictional persona sheets with the contact path open at 1280, 1062, 768, and 360 px. Frames 19–20 show social endpoints on phone. Frames 21–22 follow actual left and right phone drags through the deck. The ordered frames form a stitched MP4 walkthrough of actual browser states, rather than continuous screen recording. No customer, child, recipient, or private reply data appears.

Each card has a fictional first name and role, a short representative quote, and the same Goal, Friction, Current behavior, and Product proof fields. These are hypothesis-based composites, not interview excerpts or validated customer findings. `persona-source-map.md` records the synthetic image lineage and copy boundary. The image fills exactly half of every desktop/tablet card; phone cards use one shared 40/60 image/profile split so the four fields and open contact path fit. All images use cover-fit without letterboxing. Contact paths are secondary disclosures.

`geometry-audit.json` records 16 persona states and four social-carousel widths. At 1280, 1062, and 768 px, all four rotated card bounding boxes stayed at least 40 px inside the page and the 760 px fan stage. The tightest page edge was 57.7 px. At 360 px, only the active card was visible and stayed inside the page; the open contact path fit in the 396 px copy region. At every width, document `scrollWidth` equaled `clientWidth`. All persona and social arrows measured 44 × 44 px and remained on-screen. The active dot had selected/current semantics. Social Previous was disabled at slide 1; Next was disabled at slide 7. Actual phone left and right drags changed and restored the selected card.

The social slide retains its separate seven-slide asset sequence. Narrow arrows flank the media frame without obscuring its visible content, and seven small progress dots offer direct selection. The social slide had 276 px of width at the 360 px viewport. Keyboard Left/Right/Home/End behavior and screen-reader status remain. The persona fan retains rotations, shadows, and mobile swipe. Neither carousel autoplays.

`build-walkthrough.sh` assembles the frames into `trumpet-recruitment-persona-sheets-94caae6b.mp4` and frames 15–22 into a separate readable phone clip, `trumpet-recruitment-persona-sheets-mobile-94caae6b.mp4`. Both are H.264 at 24 fps. The wide video is 1280 × 900, 836 frames, 34.83 seconds; the phone video is 360 × 900, 304 frames, 12.67 seconds. Both passed full FFmpeg decode; encoded desktop and phone frames were visually inspected.

Validation:

- `npx vitest run app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentPersonas.test.tsx components/TrumpetRecruitmentSocialCarousel.test.tsx components/TrumpetRecruitmentMessages.test.tsx components/TrumpetRecruitmentCopy.test.tsx` — 17 passed. The tests cover shared persona field schema, names, fictional label, no demographic fields, arrows, dots, social endpoints and keyboard behavior, and deliberate versus incidental swipe gestures.
- Scoped ESLint and `git diff --check` — passed.
- `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed in isolation; existing unrelated lint warnings remain.

The route remains inactive, unlinked, and noindex. No send, schedule, provider call, data write, merge, or production deployment occurred. `capture-manifest.json` records hashes and resolves the QA commit with `git log -1 --format=%H -- docs/qa/trumpet-recruitment-visual-story`.
