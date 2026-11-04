# Accelerated L02 learner binding QA

Route: `/service-prototypes/accelerated-cohort?view=3` on the scoped localhost worktree. The `rev` query in the handoff binds the final commit. The MP4 is a privacy-safe sequence of screenshots captured during actual in-app Browser interaction; `render-walkthrough.sh` reproduces it.

## Exact lineage

- L02 native source SHA-256: `2beae8254c76a6f8bf168afb8483e83e63c13b621ec3934c81397d3167cd1a3d`
- L02 composite SHA-256: `ded23edb31cd957689617e3d132f1360957ffe3a60bb5274f478f910b09e3af6`
- L02 approved caption source SRT SHA-256: `ed1f824f36a64d9b783266c54a9840e2d89a71e1e526bd55efbbea7359d70ca0`
- The learner VTT and transcript are deterministic derivatives of that exact SRT. The source, composite, L01 media, manifest, receipt, caption identity and timing are checked before `dev` and `build` stage the assets.

## Rendered checks

- Desktop 1280×720: L01 player retained, L02 ready, L02 video playing with English captions, transcript expanded, return to plan, L03 locked.
- Tablet 820×900: L02 player with visible caption and controls; no document overflow.
- Mobile 390×844: L02 player, caption control, return action, L03 disabled video and completion; no document overflow.
- Playback check: browser `readyState=4`, `paused=false`, caption track `showing` after the play action.

No provider calls, external send, upload, publication, production-data mutation, or new spend occurred.
