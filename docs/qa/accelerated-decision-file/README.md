# Accelerated Decision File QA

Base: `ed73dee795dbcb067bf441451c49190228d7518d` on `codex/accelerated-worksheet-routing`.

## Local review

- Learner: `http://localhost:3107/service-prototypes/accelerated-cohort?qa=worksheet-fixture-ed73dee7` → **Learning plan**.
- Operator: `http://localhost:3107/admin/accelerated/decision-files?qa=ed73dee7` (admin sign-in required).
- In-app browser QA confirmed L01 → L02 → L01 answer continuity, recovery after refresh, share preview, editable redaction, consent-disabled Send, dark/light desktop at 1270 px, tablet at 768 px, and dark mobile at 390 px without horizontal overflow.
- For a safe local completion check only, enter `QA Fixture` and `qa-fixture@example.invalid` with explicit consent. The development-only route returns a synthetic success; it does not write to Supabase. The receipt states this clearly.
- The protected operator route redirected to login as intended. Google OAuth recovery unexpectedly returned to the staging origin, so authenticated localhost operator review remains pending. No token or callback URL is included in these artifacts.
- A real submission remains untested until the migration is applied to staging. The public POST fails closed if the table is unavailable; production application is outside this lane.

`worksheet-walkthrough.mp4` is an 18-second silent MP4 assembled from sequential in-app browser captures of the changed route and the protected operator gate. It is a visual walkthrough, not a continuous screen recording. `walkthrough-captions.srt` describes each three-second state. The operator gate is shown; an authenticated operator queue and a persisted fixture are not shown. The MP4 is playable (`ffprobe` reports 18.000 seconds) and the captured frames were visually inspected.

## Validation

- `vitest run app/service-prototypes/[slug]/AcceleratedLearningPlan.test.tsx lib/accelerated-decision-file.test.ts app/api/accelerated/decision-file/route.test.ts app/api/admin/accelerated/decision-files/route.test.ts` — 22 passed.
- `npm run build` — media binding checks and compile passed; Next build worker ran out of memory during repository-wide lint/type stage.
- `tsc --noEmit --pretty false` — existing repo errors remain outside this lane; no errors in changed files after the final fix.

## Next captain gates

1. Review and apply `20261105120000_accelerated_decision_file_intake.sql` to staging only.
2. Exercise a synthetic persisted submission and an authenticated operator review, including attaching an existing diagnostic audit. Confirm the linked audit is the intended learner's assessment before using it in the client dashboard flow.
3. Run desktop/mobile rendered QA on the staging preview and produce a continuous screen recording of the full persisted handoff before Vambah's Human QA.
