# L07-05 caption clearance for Phase 3B

## Exact authored source and scope

- Qualification reference: draft PR #1290 head `408418b1ca7a9a8878ce5204bbbdfbb423b8a939`.
- Caption base: draft PR #1293 head `af647b6adc101cafade371d5ca53047670d53213`.
- Player stack: draft PR #1295 head `7bb6267c9fb98172679e161aafa208dfc7a276c3`.
- Caption code commit: `9680078874` on `codex/agentified-caption-safety`.
- Approved L07 illustrated video SHA-256: `42782f17a49cc35e3e01be1f29f7de18d13ee5406004a84da7e9602aa06f2f55`.
- Approved L07 VTT SHA-256: `984fa64e556279730d30a602b3ce160620822ef0577a7ff6cf7de7028e3f8f21`.

The L07 video and VTT binding at the exact PR #1290 head matches this caption branch byte-for-byte. `L07-05-1280-before.png` shows the approved native cue at 2:08 before correction. The correction uses the existing cue-driven band below the player only for source-mapped L07-05, 127.108–153.479 seconds, at desktop Small and Medium. Mobile and Large already use the band. Existing native desktop positions in L07-01 and L07-06 remain unchanged.

## Verification

The exact #1295 player head was applied in a temporary local merge to the caption code. `git merge-tree --write-tree` reported a clean combined tree (`15cb70d6dafe30e41bce7c629fddeb14fbbd93ed`). The temporary merge was aborted after qualification; no player code was added to the caption branch.

- `node scripts/qa/verify-l07-05-caption-clearance.mjs` — PASS 57 learner states at 1280×844 and 390×844. See `receipt.json`. It verifies source hashes, exact active cue text, S/M/L, off/on and paused restoration, seeking, native controls or mobile rail, geometry, dark theme, natural playback across both scene boundaries, and return to L07-06's established native cue position.
- `node scripts/qa/record-l07-05-caption-clearance.mjs` — PASS 16 walkthrough states and two decoded MP4s. The final encoded desktop and mobile files were visually inspected; see `walkthrough-state.json`.
- Combined-stack focused Vitest: 61/61 tests passed across Agentified hero, workshop, and end-screen bindings. ESLint, Node syntax, and `git diff --check` passed.
- `node --import tsx scripts/verify-agentified-illustrated-binding.mjs` — PASS all 16 approved lesson bindings.

## Review artifacts

- `L07-05-1280-before.png` — native cue crossed teaching content before the correction.
- `L07-05-1280-collision-M-on.png` and `L07-05-390-collision-L-on.png` — corrected paused states.
- `L07-05-1280-played-through-153.479.png` — adjacent L07-06 native cue position.
- `L07-05-1280-dark-theme.png` and `L07-05-390-dark-theme.png` — theme review.
- `L07-05-1280-9680078874.mp4` and `L07-05-390-9680078874.mp4` — playable privacy-safe walkthroughs of the exact learner route and state.

This packet changes only caption presentation. It does not change cue words or timing, video/audio, approved teaching art, presenter footage/background, video geometry, controls, Aa behavior, learner data, or media bindings. All referenced PRs remain draft and unbound for captain and Phase 3B review. No merge, manual deployment, provider action, expense, publication, or release occurred.
