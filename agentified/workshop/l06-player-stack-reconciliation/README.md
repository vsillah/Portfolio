# L06-01 caption and player-stack reconciliation

## Exact heads and finding

- PR #1290 qualification head: `cd86b2ea7134465a56540e384cc98c7a23e1bbb3` (draft).
- PR #1293 prior remote head: `46b2c166ec012a06b8e0a458d6c189c5911f4a03` (draft).
- PR #1295 player head: `afdd4e2c191225eebe839e68040bf9547bda77de` (draft).
- Caption implementation tested locally: `e0275a09c488735f88dac12c15016a3155b82989` (after the original L06 implementation `4ef836a3c` and the historical stop note `e74c66c39`).

The reported 20.7168-second desktop collision occurs because PR #1295 is stacked on PR #1293's prior remote head, before the L06-01–08 external caption-band correction. The L06 implementation moves the exact active native VTT cue to the existing below-player band throughout the eight source-mapped teaching scenes. An L06-only metadata-handler edit was removed so the unchanged PR #1295 player implementation merges cleanly with it. The protected L06 end screen remains caption-free through the existing boundary effect.

The exact PR #1295 head was applied as a temporary `--no-commit` merge to the caption implementation. `git merge-tree --write-tree` returned a clean combined tree (`be80ee2963424652a60c6d35a49ab6f7a8786f03`). The temporary merge was aborted after testing; PR #1295 code is not part of the caption branch.

## Validation

- `node scripts/qa/verify-l06-player-stack.mjs` — PASS, 27 browser states on the exact combined tree at 1280×844 and 390×844. It checks L06-01 at 20.7168 seconds with Small, Medium, and Large captions; off/on and paused restoration; exact active-cue equality; approved video/VTT hashes and route bindings; video geometry; native desktop controls and mobile external rail; seek, natural playback across L06-02, mobile rail play/pause, seek, mute, volume, and fullscreen with restoration. See `receipt.json`.
- `npx vitest run app/agentified/AgentifiedLessonHero.test.tsx` — PASS, 29 tests on the combined tree.
- `npx eslint app/agentified/AgentifiedLessonHero.tsx app/agentified/AgentifiedLessonHero.test.tsx` and `git diff --check` — PASS on the combined tree.
- Visual inspection of `L06-01-1280-M-paused.png`, `L06-01-390-M-paused.png`, `L06-02-390-boundary.png`, and `L06-02-390-fullscreen.png` found the cue clear of the permission-slip headline and presenter, with controls and rail usable. Size variants are saved alongside these frames.

The earlier 390×844 native-control collision documented in `../l06-consolidated-caption-stop/` is resolved in the combined tree by PR #1295's external mobile control rail. That stop packet remains as historical evidence. The full L06 scene matrix at the caption implementation commit separately passed 258 learner states and six fixed-candidate states before this focused player-stack reconciliation.

## Integration boundary

Rebase or refresh the downstream PR #1295 stack after PR #1293's new caption head is available. Keep both PRs draft pending captain review. No approved media, VTT, caption timing, audio, presenter footage/background, artwork, video geometry, bindings, or PR #1295 control code was changed here. No media bind, provider action, expense, merge, manual deployment, publication, or release occurred.
