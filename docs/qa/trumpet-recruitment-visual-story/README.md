# Trumpet recruitment fan and swipe review

UI commit: `85f3ae98f24ca3bc378d9aa276bb8d01113c7aab`. Exact production-build localhost capture route: `http://localhost:3018/work/trumpet-trainer/recruitment?revision=85f3ae98f24ca3bc378d9aa276bb8d01113c7aab&qa=fan-swipe-video`.

The 25 PNG frames were captured in the Codex in-app browser from that build with placeholder public Supabase values and outbound n8n disabled. The orange `DEV ENVIRONMENT` strip identifies the local build. The frames cover the full-width 16:9 gameplay video and its disclosure, the preserved seven-slide social carousel, the adult card fan at 1280 and 768 px, and the single-card phone path at 360 px. The phone sequence shows a left drag advancing, a right drag reversing, settled card states, a short and predominantly vertical drag leaving selection unchanged, named selection, and the expanded community-program contact path. The active community card's open disclosure ended 16 px above the card bottom. At all three widths, document `scrollWidth` equaled `clientWidth`; there was no horizontal page overflow.

The existing gameplay MP4 loaded with `readyState=4`, played through its native controls with `paused=false` and `currentTime>0`, and reported no media error. The `<video>` retains visible controls, a poster, a source, and textual fallback. The redundant portrait screenshot card and its carousel link were removed. The social slide files, persona art, copy, noindex, and inactive boundary remain unchanged. `persona-source-map.md` records the synthetic persona asset lineage.

`build-walkthrough.sh` assembles the ordered frames into `trumpet-recruitment-fan-swipe-85f3ae98.mp4`. The final 1280 × 850 H.264 file is 39.58 seconds at 24 fps. It passed a full FFmpeg decode, and encoded frames at 10 and 30 seconds were visually inspected. It is a stitched screen walkthrough of actual browser states, including intermediate and settled swipe states, rather than continuous screen recording. No customer, child, recipient, or private reply data appears.

Validation:

- `npx vitest run app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentPersonas.test.tsx components/TrumpetRecruitmentSocialCarousel.test.tsx components/TrumpetRecruitmentMessages.test.tsx components/TrumpetRecruitmentCopy.test.tsx` — 15 passed.
- `npx eslint app/work/trumpet-trainer/recruitment/page.tsx app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentPersonas.tsx components/TrumpetRecruitmentPersonas.test.tsx components/TrumpetRecruitmentSocialCarousel.tsx components/TrumpetRecruitmentSocialCarousel.test.tsx` — passed.
- `git diff --check` — passed.
- `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed in isolation before localhost capture; existing unrelated lint warnings remain.
- `ffprobe` reported H.264, 1280 × 850, 24 fps, 950 frames, 39.58 seconds. `ffmpeg -v error -i <video> -f null -` decoded the full file without errors.

The route remains inactive, unlinked, and noindex. No send, schedule, provider call, data write, merge, or production deployment occurred. `capture-manifest.json` records hashes and resolves the final QA commit with `git log -1 --format=%H -- docs/qa/trumpet-recruitment-visual-story`; PR #1215 records the resolved hash after push.
