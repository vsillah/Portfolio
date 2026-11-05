# Trumpet recruitment visual-story review

UI commit: `899b3621ba56d3bda7f2c9309630ee8b789cd635`. Exact local route: `http://localhost:3018/work/trumpet-trainer/recruitment?revision=899b3621ba56d3bda7f2c9309630ee8b789cd635`.

The 17 screenshots were captured in the Codex in-app browser from that route, with an isolated localhost server using placeholder public Supabase values and outbound n8n disabled. No customer, child, recipient, or private reply data appears. `build-walkthrough.sh` assembles those screenshots into a 30.46-second, 1280 × 850, H.264 MP4. It shows desktop (1280 px), tablet (768 px), and mobile (360 px), including media, the clef timeline, expanded detail, scorecard, selected message, local copy confirmation, and the activation gate. The final MP4 decoded without errors. It is a stitched screen walkthrough; video playback itself was not recorded.

Validation:

- `npx vitest run app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentMessages.test.tsx components/TrumpetRecruitmentCopy.test.tsx components/TrumpetGameplayCarousel.test.tsx` — 8 passed.
- `npx eslint app/work/trumpet-trainer/recruitment/page.tsx app/work/trumpet-trainer/recruitment/page.test.tsx components/TrumpetRecruitmentMessages.tsx components/TrumpetRecruitmentMessages.test.tsx` — passed.
- `git diff --check` — passed.
- `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed. The first concurrent attempt collided with a dev server in `.next`; the isolated rerun passed.
- `npx tsc --noEmit --pretty false` — repository-wide pre-existing errors outside this lane; none reported in the changed files. The production build's type phase passed.
- Rendered document width stayed within the viewport at 360, 768, and 1280 px. The 360 and 768 timelines used one-sided cards; 1280 alternated cards. No separate light-theme control was present on this route.

The recruitment route remains inactive, unlinked, and noindex. No send, schedule, provider call, or data write was exercised.
