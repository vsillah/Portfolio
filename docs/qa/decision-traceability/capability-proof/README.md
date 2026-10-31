# Dark Castle capability proof review

Current code commit: `5dbd76b4` on `codex/dark-castle-capability-proof`. Captured 2026-10-31 from the production-style local build at:

`http://localhost:3131/decision-traceability-scorecard?utm_source=linkedin&utm_campaign=dark_castle_decision_traceability&rev=5dbd76b4&presentation=production`

The current evidence is in [`revision-5dbd76b4/`](./revision-5dbd76b4/). The older files in this directory belong to commit `fa11ad9456d63d3a99ff53c107403cd82dbbc728` and are retained as superseded evidence. They are not the current Human QA artifact.

## Current evidence

- `01-hero.jpg` through `14-worksheet.jpg`: 390×844 in-app browser captures. They show the hero, all six capability gallery choices, comparison, an empty assessment, four answered checks, 5/8 ownership result, worksheet, and consent selected then cleared. `09-assessment.jpg` was reloaded to show the intended empty state.
- `15-tablet-coach.jpg`: 768×844 gallery and clip layout.
- `16-desktop-hero.jpg`: 1280×844 hero and product proof.
- `walkthrough.mp4`: 32-second H.264, 380×822, silent mobile walkthrough from the exact route above. The six-second Coach segment places the exact first-party `coach-loop.mp4` pixels over its own video area in the captured page frame. The other frames are the in-app browser captures in order. FFprobe reports 768 frames at 24 fps; full decode completed without error and representative frames were visually checked. This is a QA composition of observed page states, not a claim of continuous screen recording.

The gallery previous/next wrap and End keyboard action worked in the rendered page. The Coach clip loaded with `muted`, `autoplay`, `loop`, and `playsInline`, and reached ready state 4. No horizontal document overflow was observed at 390, 768, or 1280 CSS pixels. Four sample selections produced 5/8 and the ownership next action. The PDF downloaded successfully; the temporary download was removed. Email remained empty, consent toggled on and off, and no follow-up request was submitted. The page and sampled clip frames showed no internal or QA labels.

The build used `NEXT_PUBLIC_APP_ENV=production` to omit the local development banner. `MOCK_N8N=true` and `N8N_DISABLE_OUTBOUND=true` disabled outbound n8n behavior. This is local review evidence; no deployed preview, production smoke, or customer-data path was exercised. Exact capture/clip provenance, crop coordinates, claims, boundaries, and hashes are in [`../capability-proof.md`](../capability-proof.md).

Validation: `npm test -- --run app/decision-traceability-scorecard/scorecard.test.tsx lib/decision-traceability.test.ts app/api/decision-traceability/route.test.ts` (17 passed); `NEXT_PUBLIC_APP_ENV=production MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` (passed); `git diff --check` (passed). Existing unrelated lint and Browserslist warnings remain.
