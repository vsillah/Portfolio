# Trumpet recruitment interactive deck review

UI commit: `feb3076886faabc26737a851bbcc8721d2621c89`. Exact local capture route: `http://localhost:3018/work/trumpet-trainer/recruitment?revision=feb3076886faabc26737a851bbcc8721d2621c89&qa=interactive-deck`.

The 23 PNG frames were captured from the production build in the Codex in-app browser with placeholder public Supabase values and outbound n8n disabled. The orange `DEV ENVIRONMENT` strip identifies the local build. The frames cover 1280 × 850, 768 × 850, and 360 × 800 viewports; one active social slide with previous, next, numbered selection, and keyboard End; all four contextual persona scenes; previous, next, and named persona selection; headline/support copy; and expanded contact-path disclosure. At each width, document `scrollWidth` equaled `clientWidth`; there was no horizontal overflow. The approved social slide bytes and product media were unchanged. Only the four approved synthetic persona scenes are served; see `persona-source-map.md` for hashes and prompt intent.

`build-walkthrough.sh` assembles the frames in order into `trumpet-recruitment-interactive-deck-feb30768.mp4`. The final 1280 × 850 H.264 file runs 36.42 seconds at 24 fps and passed a full FFmpeg decode. It is a stitched screen walkthrough showing real interaction states, rather than a continuous screen recording. No customer, child, recipient, or private reply data appears.

Validation:

- `npx vitest run app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentPersonas.test.tsx components/TrumpetRecruitmentSocialCarousel.test.tsx components/TrumpetRecruitmentMessages.test.tsx components/TrumpetRecruitmentCopy.test.tsx` — 12 passed.
- `npx eslint app/work/trumpet-trainer/recruitment/page.tsx app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentPersonas.tsx components/TrumpetRecruitmentPersonas.test.tsx components/TrumpetRecruitmentSocialCarousel.tsx components/TrumpetRecruitmentSocialCarousel.test.tsx` — passed.
- `git diff --check` — passed.
- `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed in isolation, before localhost capture; existing unrelated lint warnings remain.
- `ffprobe` reported H.264, 1280 × 850, 24 fps, 874 frames, 36.42 seconds. `ffmpeg -v error -i <video> -f null -` decoded the full file without errors.

The route remains inactive, unlinked, and noindex. No send, schedule, provider call, data write, merge, or deployment occurred. `capture-manifest.json` records hashes and resolves the final QA commit with `git log -1 --format=%H -- docs/qa/trumpet-recruitment-visual-story`; PR #1215 records the resolved hash after push.
