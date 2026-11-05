# Trumpet recruitment adult-card review

UI commit: `5edd5e091476a42423b434292ee06379b540f7ec`. Exact local capture route: `http://localhost:3018/work/trumpet-trainer/recruitment?revision=5edd5e091476a42423b434292ee06379b540f7ec&qa=adult-card-copy`.

The 20 PNG frames were captured in the Codex in-app browser with placeholder public Supabase values and outbound n8n disabled. The orange `DEV ENVIRONMENT` strip identifies the local build. The desktop hero and mobile hero were captured at scroll position zero. The adult-perspective cards were inspected at 1280 px (four columns), 768 px (two columns), and 360 px (one column, two frames), with no document overflow or card collision. No decorative persona icons remain. The other frames show the unchanged media, timeline, expanded detail, scorecard, selected draft, local copy confirmation, and activation gate.

`build-walkthrough.sh` assembles the ordered frames into `trumpet-recruitment-adult-cards-5edd5e09.mp4`. The final 1280 × 850 H.264 file is 35.83 seconds at 24 fps. A full FFmpeg decode passed, and contact sheets of both the 20 source frames and the MP4 sequence were visually audited. It is a stitched screen walkthrough; gameplay video playback itself was not recorded. No customer, child, recipient, or private reply data appears.

Validation:

- `npx vitest run app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentMessages.test.tsx components/TrumpetRecruitmentCopy.test.tsx components/TrumpetGameplayCarousel.test.tsx` — 9 passed.
- `npx eslint app/work/trumpet-trainer/recruitment/page.tsx app/work/trumpet-trainer/recruitment/page.test.tsx` — passed.
- `git diff --check` — passed.
- `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed in isolation, before localhost capture.
- `ffprobe` reported H.264, 1280 × 850, 24 fps, 860 frames, 35.83 seconds. `ffmpeg -v error -i <video> -f null -` decoded the whole file without errors.

The route remains inactive, unlinked, and noindex. No send, schedule, provider call, data write, or deployment occurred. `capture-manifest.json` records exact artifact hashes and resolves the final QA commit with `git log -1 --format=%H -- docs/qa/trumpet-recruitment-visual-story`; PR #1215 records the resolved hash after push.
