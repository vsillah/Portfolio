# L08 completion card correction for Phase 3B

This package is an authored, review-only patch against the exact PR #1295 player head `7bb6267c9fb98172679e161aafa208dfc7a276c3`. PR #1296 is a source-composition branch based on a different draft stack; its product files are not changed by this package. The integration captain can apply `player-head-7bb6267c9.patch` after sequencing #1295. Do not apply it to a different player head without review.

The patch changes only `AgentifiedLessonHero.tsx`, its focused test, and `workshop.module.css`. On the resting/completion state, the video remains mounted for progress and replay but its frame is hidden. The completion composition fills the entire 16:9 viewfinder. The existing custom player rail appears inside the viewfinder on desktop while resting; mobile keeps its rail below the viewfinder. Seeking back or replaying restores the video and native desktop controls. The next-lesson poster keeps its original 1280×720 bytes and is shown at its full 16:9 ratio with no cover crop.

The L08 card's current next action is the separate footer button labeled `Next lesson · L09`; the card itself remains noninteractive. The route recording clicks that footer control and verifies L09. This patch does not change lesson wording, poster files, source video, audio, VTT, timing, destination, progress, Aa settings, or outer player dimensions.

## Evidence and validation

- `route-evidence/` contains synthetic-guest desktop 1280×844 and mobile 390×844 MP4 route recordings, before/after stills, dark-theme stills, L16 completion checks, and `route-capture.json`. The MP4 route recordings are visual-only browser captures.
- The final disposable route is `http://127.0.0.1:3152/agentified/learningplan?lesson=L08&rev=7bb6267c9-f709e881-302b83e1`. Its revision binds the player head, candidate media, and patch hash; the product files in that checkout remain temporary.
- The route script covers pre-completion, seek-to-end, paused resting state, full poster/card geometry, captions off/on and Aa sizes, sound and seek controls, natural completion, replay, and footer navigation to L09.
- `validation-receipt.json` binds the exact player head, PR #1296 source head, original poster and media hashes, patch hash, viewport geometry, checks, MP4 hashes, and typecheck limitation.
- Focused player test: 29/29 passed. Full `tsc --noEmit` reports 46 errors in unrelated repository files and none in the three patch files.

To check the patch against the clean #1295 index before applying:

```bash
git apply --check --cached agentified/workshop/phase-3b-review/text-panel-padding/l08-completion-card-source/player-head-7bb6267c9.patch
```

The local route used a disposable #1295 checkout with a temporary L08 candidate media binding. No product binding, PR merge, deployment, provider call, spend, publication, or release is part of this package.
