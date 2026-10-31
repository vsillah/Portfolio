# Capability proof review

Code commit: `e2cd3ea94943d48b7d48a122845bf7067a2ca468` on `codex/dark-castle-capability-proof`. Captured 2026-10-31 from that commit at:

`http://localhost:3131/decision-traceability-scorecard?utm_source=linkedin&utm_campaign=dark_castle_decision_traceability&rev=e2cd3ea94943d48b7d48a122845bf7067a2ca468&presentation=production`

The localhost build used `NEXT_PUBLIC_APP_ENV=production` solely to match the customer-facing presentation and remove the development banner. `MOCK_N8N=true` and `N8N_DISABLE_OUTBOUND=true` prevented outbound n8n calls. This is local evidence, not a deployed preview or production smoke.

- `desktop-full.jpg`: full page at 1280×800.
- `mobile-full.jpg`: full page at 390×844.
- `frame-01` through `frame-09`: mobile flow from the hero through six capability scenes, assessment, sample answers, score/PDF, and untouched optional follow-up.
- `mobile-walkthrough.mp4`: 18-second H.264 video made from those sequential browser frames; decoded size 380×822, nine frames. It has no audio. `ffprobe` and a decoded frame were checked after encoding.

The in-app browser showed six distinct scenes, all four questions in their intended reading order, and no horizontal document overflow at 390, 768, or 1280 widths. Sample selections produced 5/8 and the ownership next action. The email remained blank and consent unchecked. The PDF link was visible. No follow-up request was submitted, and no live email/provider path was exercised. Browser and native Dark Castle feature availability is scoped in `../capability-proof.md`.

Validation: `npm test -- --run app/decision-traceability-scorecard/scorecard.test.tsx lib/decision-traceability.test.ts app/api/decision-traceability/route.test.ts` (16 tests passed); `NEXT_PUBLIC_APP_ENV=production MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` (passed); `git diff --check` (passed). Existing unrelated build lint warnings remain.
