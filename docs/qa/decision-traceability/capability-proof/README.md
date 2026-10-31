# Dark Castle capability proof review

Code commit: `fa11ad9456d63d3a99ff53c107403cd82dbbc728` on `codex/dark-castle-capability-proof`. Captured 2026-10-31 from that commit at:

`http://localhost:3131/decision-traceability-scorecard?utm_source=linkedin&utm_campaign=dark_castle_decision_traceability&rev=fa11ad9456d63d3a99ff53c107403cd82dbbc728&presentation=production`

The localhost build used `NEXT_PUBLIC_APP_ENV=production` solely to match the customer-facing presentation and remove the development banner. `MOCK_N8N=true` and `N8N_DISABLE_OUTBOUND=true` prevented outbound n8n calls. This is local evidence, not a deployed preview or production smoke.

- `desktop-full.jpg` and `desktop-proof.jpg`: full page and product proof at 1280×800.
- `tablet-full.jpg` and `tablet-proof.jpg`: full page and product proof at 768×900. Cards use one column at this width for legibility.
- `mobile-full.jpg`: full page at 390×844.
- `frame-01` through `frame-09`: mobile hero, six actual Dark Castle capture scenes, bounded competitor comparison, empty assessment, sample answers and 5/8 score, worksheet and untouched optional follow-up.
- `mobile-walkthrough.mp4`: 18-second H.264 video of the nine ordered frames; decoded size 380×822. It has no audio. `ffprobe` and decoded frames were checked after encoding. Frame 07 was re-recorded after the initial anchor scroll had not settled.

The in-app browser showed the exact code revision, nine exact-source image crops in six capability scenes, all four questions in their intended reading order, and no horizontal document overflow at 390, 768, or 1280 widths. Sample selections produced 5/8 and the ownership next action. The PDF link downloaded successfully; the temporary copy was removed afterward. The email remained blank, consent was toggled on and off, and no follow-up request was submitted. No provider or customer-data path was exercised. Browser and native Dark Castle feature availability, image crop coordinates and hashes, and official competitor sources are recorded in `../capability-proof.md`.

Validation: `npm test -- --run app/decision-traceability-scorecard/scorecard.test.tsx lib/decision-traceability.test.ts app/api/decision-traceability/route.test.ts` (16 tests passed); `NEXT_PUBLIC_APP_ENV=production MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` (passed); `git diff --check` (passed). Existing unrelated build lint warnings remain.
