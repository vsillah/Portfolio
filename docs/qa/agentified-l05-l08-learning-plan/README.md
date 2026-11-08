# Agentified L05–L08 Learning Plan review

## Binding

- Base main: `528466d9f32e13b48d6181b67fff97dd9b31dd44`
- Reviewed application commit: `d86e273fd922c70f9cc1ed6a8cb46e350abc8f79`
- Local route: `http://localhost:3219/agentified/learningplan?lesson=L05&revision=d86e273fd922c70f9cc1ed6a8cb46e350abc8f79`
- Approved source: merged PR #1252, `agentified/workshop/l05-l08-continuous-narration/`; source commit `a260c7593758fd6757ea21ef240a9abc83cc3725`; provider batch SHA-256 `398b0032f735cae199817634f997db89099dbf0c0a9b6c6c123d318c3067eeb1`.
- Public MP4 and VTT paths include the first eight characters of each immutable composite hash. `lib/agentified-l05-l08-media.test.ts` verifies public bytes against the approved package, receipt, and complete caption-derived transcript.
- Four guided-work countdowns are encoded in the approved composites. Their receipt windows are exactly 45 seconds and the source validator checks moving countdown frames. The learner uses the existing HTML video player and default English captions.

## Local validation

- `node agentified/workshop/l05-l08-continuous-narration/validate.mjs` — passed.
- `npx vitest run lib/agentified-l05-l08-media.test.ts app/agentified/AgentifiedLessonHero.test.tsx app/agentified/AgentifiedWorkshop.test.tsx` — 20 tests passed.
- `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-build-only-anon-key npm run build` — passed. The first default-heap attempt ran out of memory; the second lacked public Supabase env values. The passing build used synthetic build-only values and made no live backend request.
- `node scripts/qa/record-agentified-l05-l08-learning-plan.mjs http://localhost:3219 d86e273fd922c70f9cc1ed6a8cb46e350abc8f79` — passed at 1440×900, 820×1000, and 390×844 against the production build. It checked exact video duration/path, default captions, transcript, worksheet, guest progress/resume, Operating File continuity, no horizontal overflow, and L09 locked state.

## Artifacts and limits

- `desktop-walkthrough.mp4`, `tablet-walkthrough.mp4`, and `mobile-walkthrough.mp4` are synthetic guest walkthroughs with no private account data. Their corresponding `*-countdown.png` stills show the rendered 45-second timer for each lesson at each width.
- The MP4s were H.264 encoded and checked with `ffprobe`; selected desktop and mobile frames were visually inspected.
- No live member account, production route, external media provider, Supabase mutation, or Human QA was exercised. Member resume is covered with a synthetic account unit test. Vercel preview checks belong to the draft PR gate.
