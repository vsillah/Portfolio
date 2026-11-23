# L06 consolidated caption clearance: visual stop

Local code commit: `4ef836a3c` on `codex/agentified-caption-safety`. Remote PR #1293 remains at `46b2c166ec012a06b8e0a458d6c189c5911f4a03` and draft. PR #1290 was confirmed at `c9c4bacc48b5baab58b882154a5eb9e16cacac58` and draft before the pass.

The code extends the existing cue-driven external band from L06-03 to all eight source-mapped L06 teaching scenes, ending at the protected completion screen at 255.493 seconds. Unit tests and static checks passed. Browser verification passed 258 learner states at 1280×720 and 390×844 and six fixed-candidate states, covering scene edges and midpoints, Small/Medium/Large, off/on restoration, seeking, natural scene-boundary playback, controls, and protected ending. Approved learner video and VTT hashes matched the binding. The detailed local matrix is `matrix-receipt.json`.

Visual review found a different failure class at L06-01, 390×844: with the video paused and native controls visible, the controls cover the lower source headline and cross the presenter area. See `L06-01-390-paused-controls.png`. The source media and player geometry were not edited by this local caption correction. Desktop caption clearance is illustrated by `L06-01-1280-caption-clear.png`; the protected mobile ending is in `L06-390-protected-ending.png`.

Per the bounded authorization, stop before push. Do not alter source media, video geometry, controls, presenter composition, or protected ending in this caption lane. Route the control/source-layout conflict to a separate review and reconcile PR #1294's shared hero component overlap in the captain lane. No media bind, provider action, expense, merge, deployment, publication, or release occurred.

## Later reconciliation

The exact PR #1295 player head `afdd4e2c191225eebe839e68040bf9547bda77de` replaced the mobile native controls with an external rail. Its clean combined tree with the L06 caption implementation passed the focused L06-01 caption/control matrix; see `../l06-player-stack-reconciliation/`. This stop remains a record of the earlier player state, not a current blocker for the combined stack.
