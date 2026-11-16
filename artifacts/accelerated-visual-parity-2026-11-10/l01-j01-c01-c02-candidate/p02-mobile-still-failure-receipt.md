# P02 mobile still gate: failed

Review scope: one local, unrendered optical-alignment revision after `ebac6bd6` on `codex/accelerated-lesson-pacing-audit`. The fixed presenter remains at the middle-right anchor. The three focus plates were shifted down by 38 source pixels and their lower fade shortened for this still-only check.

At 390×844 with controls visible, the main Signals, Alignment, and Momentum headings remain recognizable, but the plate subtitles and supporting labels are too small to read. The Momentum micro-labels are especially weak. This fails the required mobile readability gate even though the art clears the visible controls. The simulated stills do not establish final caption clearance.

Evidence (local review stills; SHA-256):

- `P02-signals-middle-390x844-controls.png`: `858fad94080594d913f5a47b57d4ad233946f612965e36c5602a3377c89afd69`
- `P02-alignment-middle-390x844-controls.png`: `5057825b6d177940baceb4320922daa9485db9548057c0cf7585054583a38f76`
- `P02-momentum-middle-390x844-controls.png`: `21686d8784c63b5038f545ee5347b44b89fae7b8af361eaca1286c9493b12ed6`

Result: stop before video render. No new reel, audio modification, learner binding, provider call, or Human QA claim. The uncommitted placement experiment and stills remain local review material. Any next P02 production attempt needs a separately scoped composition that makes the source art's key claim readable at mobile size while retaining its integrity and the fixed presenter anchor.
