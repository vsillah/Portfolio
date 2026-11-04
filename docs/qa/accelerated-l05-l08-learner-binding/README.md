# Accelerated L05–L08 learner-plan QA

Code commit reviewed: `168fd1f1b3f76a5c1ddd9b53854ecb93590dc862` (base `9dda6126fb0bab0468080e394b5b3d91806a99f9`). The only subsequent commit in this PR adds this QA packet; the application code and approved media are unchanged.

Local route: `http://localhost:3105/service-prototypes/accelerated-cohort?view=3&revision=168fd1f1b3f76a5c1ddd9b53854ecb93590dc862`

Capture source: integrated Codex browser, production build from the code commit above. Outbound n8n behavior was disabled during localhost review. Screenshots contain only the public service prototype and approved lesson media. The [MP4](accelerated-l05-l08-learner-plan-walkthrough.mp4) is a 32-second sequence of captured browser states from the exercised path; it contains no private account data or live customer records.

Validated behavior:

- L05–L08 ready states, player entry, English-caption controls, read-along transcript, return flow, and completion progress. Video metadata loaded at 600, 660, 600, and 720 seconds respectively. L05 playback advanced in the browser.
- L04 and L09 locked; the binding test covers L09–L16 locks and preservation of L01–L04.
- Desktop 1270 × 720, tablet 820 × 900, and mobile 390 × 844 viewport overrides; light and dark themes. The mobile content width had no horizontal overflow (`scrollWidth = clientWidth = 380`).

Validation commands:

```text
npx vitest run 'app/service-prototypes/[slug]/AcceleratedL05L08Binding.test.tsx' 'app/service-prototypes/[slug]/AcceleratedL03Binding.test.tsx' 'app/service-prototypes/[slug]/AcceleratedLearningPlan.test.tsx'
NODE_OPTIONS=--max-old-space-size=8192 N8N_DISABLE_OUTBOUND=true MOCK_N8N=true npm run build
ffmpeg -v error -i docs/qa/accelerated-l05-l08-learner-binding/accelerated-l05-l08-learner-plan-walkthrough.mp4 -f null -
```

All 19 focused tests passed. The production build passed. The MP4 passed full decode. Browser captures exercised this public prototype; no authenticated or production-data workflow was tested.
