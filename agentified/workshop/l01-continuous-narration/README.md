# Agentified L01 continuous narration

This package preserves the approved Gray Sweater L01 composite as the visual source of truth and adds the exact authorized 544-word HeyGen narration beneath the instructional slides. Existing presenter footage and native audio remain unchanged at `00:00-00:13.633` and `08:38.840-08:41.593`.

Run from the repository root:

```bash
node agentified/workshop/l01-continuous-narration/render.mjs
```

The renderer is provider-free. It aligns the single narration source to sentence-complete silences, distributes those sentences across their version-bound teaching windows, preserves the guided learner-work pause, regenerates English captions, and fails on window overflow or any unexpected narration gap longer than 12 seconds. It does not change learner-facing playback or production data.
