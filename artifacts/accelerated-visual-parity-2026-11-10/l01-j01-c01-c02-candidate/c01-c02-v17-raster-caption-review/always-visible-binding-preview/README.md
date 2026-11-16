# Always-visible L01 caption binding preview

Status: **local review only**. This package uses the exact MP4 approved for local Human QA on 2026-11-11, SHA-256 `80a1be496b7b05e1ae7bf6bff2cd00e2410374e6c8abe65e280fe7e4c444d0d1`, from source commit `3a2df476a96d3106823537c2442a72bd69a95080`. The voice-bearing MP4 stays outside Git and is served only from the local parent folder. The 175-cue source is the committed parent `caption-plan.json` at SHA-256 `d917317e98f7dc05590e714097af9faf00a9c09236ce894a18c214ce9138b21e`.

`build.py` derives `captions.vtt`, `transcript.json`, and `receipt.json` from that plan and fails if either source hash or the 345-second video geometry drifts. `review.html` shows the MP4 with native controls, an opt-in synchronized read-along panel, and an opt-in full keyboard-accessible transcript. It calls the embedded captions **always visible**. It contains no caption track or on/off toggle, so the prototype cannot overlay a second set of rendered captions. The WebVTT is available as a separate timed-text download. This is a prototype of the selected UI approach; assistive-technology review remains required before learner binding.

From the repo root:

```bash
python3 artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/c01-c02-v17-raster-caption-review/always-visible-binding-preview/build.py check
python3 artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/c01-c02-v17-raster-caption-review/always-visible-binding-preview/serve.py
```

Open the printed localhost URL in the integrated browser. The source media is absent from clean checkouts; `build.py` fails closed there. Nothing in this folder changes `public/`, `lib/accelerated-visual-parity-bindings.json`, `lib/accelerated-end-screen-bindings.json`, `AcceleratedLearningPlan.tsx`, or learner progress.

## Later binding work

Follow the [L01 learner-media binding plan](../../../../../docs/accelerated-course-modules/l01-learner-media-binding-plan-2026-11-11.md) before any production/player change. The 345-second duration requires coordinated updates to end-screen metadata, read-along transcript, the displayed lesson/course time, and saved resume positions from the current 540-second lesson. Keep the previous immutable assets for rollback; stop on hash drift, duplicate captions, transcript mismatch, an unusable 390-pixel layout, or failed validation. Any actual media placement, learner binding, merge, or release is a separate gate.
