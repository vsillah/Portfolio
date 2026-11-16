# P02 bounded motif still gate: failed after three variations

Scope: up to three approved review-only, still-only P02 compositions on draft PR #1270 after `42585045`. All used the owned SAM source heading and source motifs (Signals target, Alignment trophy, Momentum loop), kept the complete SAM map as a context view, and kept the presenter fixed at source `(1136,348,672,384)`. No video render was attempted.

| Variation | Inspected | Result |
| --- | --- | --- |
| 1 | Signals desktop | Target stayed near source size, too small and high beside the presenter; heading retained a subtitle sliver. Rejected as visual weakness. |
| 2 | Complete map and all three sections, desktop and 390×844 | Headings and motifs read, stayed centered beside the presenter, and cleared simulated controls. Alignment and Momentum masks retained small fragments from adjacent source elements. Rejected for unfinished source-art boundaries. The fragments did not change the SAM claim. |
| 3 | Alignment desktop and 390×844 | The tighter mask cut through the source word `Outcomes` at the trophy's base, leaving broken lettering. This is a source-art misrepresentation and triggers the stop condition. Other views were not inspected after this failure. |

Local presenter-bearing evidence and SHA-256 values:

- `p02-bounded-motif-stills/p02-signals-desktop-controls.png`: `21ca3f114e1525b20efcdb9f906a8e2c2e9a11a5a71799e92c7ea3aaa2d65110`
- `p02-bounded-motif-stills-v2/p02-signals-desktop-controls.png`: `b4fefd289684421dfb941316e9d9ac19cc7ff9ffb805008774a5a67b6230f2bd`
- `p02-bounded-motif-stills-v2/p02-signals-390x844-controls.png`: `8a7d0b5a5776e347930ca974dbc3c04e2ec22c8b4ca57fcb8c85a1fc4fc9264a`
- `p02-bounded-motif-stills-v3/p02-alignment-desktop-controls.png`: `e2a3728ccdc848c0d375b39726b580f2a0b78a56bd6a0b3cda5193ec79a5f875`
- `p02-bounded-motif-stills-v3/p02-alignment-390x844-controls.png`: `8e3e38672caa4b77347ae3c0899c1c5598e4166ed012f5872f5e0497b63de921`

Each local variation folder's `receipt.json` binds all eight generated still paths and hashes. Those folders are worktree-ignored. The full-map still preserves the whole SAM art but its micro-labels are context only at 390px; it does not qualify as a readable focused section.

Outcome: no candidate passed, and no further variation is authorized in this round. No video, HeyGen, spend, learner-media or J01 timing change, merge, release, or Human QA readiness claim. A later design scope must decide whether the Alignment view keeps the `Outcomes` word completely or crops strictly above it without a visible fragment, then validate every section and the caption-safe band in the final player.
