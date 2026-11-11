# Learning Plan autosave synthetic review

Source code revision: `15014e68` (`fix: prevent Learning Plan hydration autosave`). The capture script runs against `http://localhost:3211/accelerated/learningplan?fixture=synthetic-member-autosave&rev=15014e68` with a synthetic local Supabase session and intercepted member API responses. The query identifies the review build; it does not enable a production fixture.

The desktop (1440 × 900) and mobile (390 × 844) MP4s show a saved synthetic answer loaded from GET, a pause beyond the 1.2-second debounce with zero member POSTs, a reload with zero member POSTs, and one answer edit producing one revision-guarded POST (`12 → 13`). The white panel is a capture-only diagnostic overlay showing the intercepted POST count. No production account, database, or provider was contacted.

Run a local server with inert Supabase values, then record:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:59999 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npx next dev -p 3211
QA_REVISION=15014e68 node scripts/qa/record-accelerated-learningplan-autosave.mjs
```

The script transcodes Playwright's raw capture to H.264/yuv420p MP4, checks codec and duration with `ffprobe`, and decodes each file with `ffmpeg -f null`. `results.json` records the expected revision and POST payload. Browser auth and member API behavior are synthetic; the integration captain still owns preview review and Human QA handoff.
