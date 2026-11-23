# L08 caption-free presenter source candidate

This is a review-only source correction for the two existing native presenter panels in L08. It does not change learner media bindings, captions, timing, layout, text, or release state. The caption-free source is the retained HeyGen job `76d5248d34be0265512f59385e163415` output. `build.mjs` binds its SHA and the prior illustrated composite SHA, recreates only the opening and closing presenter panels with the existing compositor settings, and copies the prior audio and subtitle streams.

## Reproduce

From the repository root:

```bash
node agentified/workshop/phase-3b-review/text-panel-padding/l08-caption-free-presenter/build.mjs
```

The candidate and its binding receipt are in this folder. The temporary learner route used a separate disposable worktree at PR #1295 head `7bb6267c9fb98172679e161aafa208dfc7a276c3`; it was never bound in this PR. `record-route.cjs` captured that route at 1280×844 and 390×844 with captions on/off, S/M/L sizes, interval seeks, completion, replay, and mobile controls. Its visual-only route MP4s, stills, and the audio-bearing opening/closing media clips are in `route-evidence/`.

`validation-receipt.json` records the candidate, route, source, audio/subtitle parity, join diagnostics, artifact hashes, and limitations. The audio-bearing clips contain the opening 0–16.5 s and closing 244–257.68 s, including both joins. The route recordings contain browser-rendered controls and caption states but no captured sound.

The comparison is scoped to a caption-free native presenter. Illustrated teaching labels and the independent learner captions remain as authored. No provider call, spend, product binding, merge, deployment, or release occurred in this lane.
