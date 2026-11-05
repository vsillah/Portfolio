# Accelerated Decision File QA

Branch: `codex/accelerated-worksheet-routing`. The exact correction commit is recorded in PR #1209.

## Local review

- Learner: `http://localhost:3109/service-prototypes/accelerated-cohort?qa=worksheet-fixture-ed73dee7` → Learning plan.
- Operator synthetic fixture: `http://localhost:3109/admin/accelerated/decision-files?qa_fixture=accelerated_decision_file_v1`. This fixture is available only in development and makes no API calls or writes. The normal operator route remains behind `ProtectedRoute`.
- The continuous sampled capture in `worksheet-walkthrough.mp4` shows the learner worksheet across lessons, reload recovery, share review, consent, the development-only no-write receipt, and the synthetic operator queue on desktop and narrow mobile. It includes review state, a non-link example candidate, an empty queue, and a closed review. Capture frames are preserved separately in `continuous-frames/`; `render-walkthrough.sh` reproduces the MP4. The source was captured from one in-app browser tab without cuts. The 3 fps output is intentionally a sampled screen walkthrough; rapid pointer motion is not represented.
- `ffprobe` reports a playable 17-second H.264 MP4. Frames were inspected for legibility and private information. The synthetic name and `.invalid` email are used only for the local no-write completion fixture.
- Desktop and 390 px mobile screenshots document the revised operator hierarchy. The disabled assessment action explains that a verified existing audit ID is required. An invalid synthetic service ID appears as noninteractive example text.
- A real submission and authenticated operator save remain untested until the migration is applied to staging. No migration, private contact, assessment, provider, or external action was performed in this lane.

## Validation and limits

- Focused Vitest tests cover worksheet behavior, canonical idempotency digest, catalog identity and route validation, protected API behavior, and the development-only fixture gate.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build` passed, including media binding checks, compile, lint/type gate, static pages, and build traces. Existing non-blocking lint warnings remain outside this lane.
- Preview deployments for both Portfolio Vercel contexts must be checked against the correction commit. The development fixture is intentionally absent from previews; it is not a staging data substitute.

## Next captain gates

1. Review and apply `20261105120000_accelerated_decision_file_intake.sql` to staging only.
2. Exercise a synthetic persisted submission and authenticated operator review, including a verified existing diagnostic audit match. Confirm the linked audit belongs to the same learner.
3. Perform staging desktop and mobile QA on the persisted flow before any client-facing Human QA handoff. Production migration, external sends, merge, and deployment remain outside this development lane.
