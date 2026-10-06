# Rolling campaign review QA

Synthetic Campaign → Content Calendar → Social Insight walkthrough on the actual application pages. This is local UI/handler verification, not production or live-database proof.

- Route: `http://127.0.0.1:4021/admin/campaigns/campaign-review-qa?tab=content-calendar`.
- Widths: 390, 768, 1440. Desktop includes the actual admin sidebar.
- Final receipt: `results.json`; zero external browser requests and zero page errors.
- Evidence: `*-coverage.png`, `*-blocked.png`, `*-prepared.png`, `*-evidence-recovery.png`, `*-review-copy.png`, `*-cadence.png`, and `*-walkthrough.mp4`.
- Playback: H.264, yuv420p, MP4 with faststart. No narration or private data.
- The harness uses the real preparation route/service with an in-memory Supabase adapter, synthetic admin/session data, and intercepted API requests. All nonlocal requests are counted and blocked. The existing telemetry script is suppressed before insertion.
- Checked: filters, counts, pagination, clear filter, empty ready state, provenance disclosure, evidence recovery, preparation, exhausted-batch disabled state, duplicate request handling, copy-review navigation, cadence save and reload.
- `tests.txt`: 49 tests passed. `lint.txt`: scoped lint clean. `typecheck.txt`: four existing standalone test-file errors, verified against base.
- Production build: `NEXT_TELEMETRY_DISABLED=1 MOCK_N8N=true N8N_DISABLE_OUTBOUND=true NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3999 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-qa SUPABASE_SERVICE_ROLE_KEY=synthetic-qa npm run build` passed (exit 0). Existing image/Browserslist warnings only.
- Reproduction commands and limitations: `../../rolling-review-backlog-handoff.md`.

No live customer-data smoke, database migration, provider execution, Slack/SMS/Gmail send, or manual deployment was performed. Neither Vercel context was verified for this branch; integration remains with the captain. Keep this lane open through Human QA.
