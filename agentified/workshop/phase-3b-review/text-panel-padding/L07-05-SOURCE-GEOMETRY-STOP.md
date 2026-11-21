# L07 ordered padding audit: source geometry stop

The lesson-order audit reached L07-05 and stopped. L07-01 through L07-04 have review-only padded frames, exact-source desktop/mobile scene clips, and pixel-confinement checks. The source L07 MP4 SHA-256 is `42782f17a49cc35e3e01be1f29f7de18d13ee5406004a84da7e9602aa06f2f55`; its VTT SHA-256 is `984fa64e556279730d30a602b3ce160620822ef0577a7ff6cf7de7028e3f8f21`.

**First failure: L07-05 approved framework geometry.** Its semantic brief requests an approved Authority Ladder focused on Route and specifies `crop_source_px: [450, 1750, 2200, 1500]` from the complete 3000×4700 plate SHA-256 `073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b`. The resulting 1920×1080 candidate shows only the Route-rung fragment with a faded top and bottom. The human gate, neighboring connectors, and output path of the source ladder are absent. The text-padding pass preserved that source treatment; it cannot make this fragment a complete standalone recreation. The candidate and its two decoded clips are **rejected evidence**, not a passing review treatment.

`verify-l07-05-stop.py` writes `l07-05-stop-receipt.json` with exact frame, receipt, clip, VTT, source, and corrected stack hashes (#1293 `af647b6adc101cafade371d5ca53047670d53213`, #1295 `7bb6267c9fb98172679e161aafa208dfc7a276c3`). It confirms that the first four scene frames change only fitted panel unions and that all ten scene-local clips decode. The L07-05 failure was identified from the approved source geometry and rendered candidate; this stopped sweep did not rerun source-route caption/player states. L07-06 onward, including L08–L16, remains unqualified in this lane.

Reproduce:

```bash
node agentified/workshop/presentation-illustration-audit/render-semantic-visuals.mjs --padding-review --scenes=L07-05 --receipt-name=candidate-receipt-L07-05
PYTHONDONTWRITEBYTECODE=1 python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L07-05 desktop
PYTHONDONTWRITEBYTECODE=1 python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L07-05 mobile
PYTHONDONTWRITEBYTECODE=1 python3 agentified/workshop/phase-3b-review/text-panel-padding/verify-l07-05-stop.py
```

Next gate: the source illustration owner supplies and approves a complete, source-faithful L07-05 Route treatment. Then repeat its visual, mobile reading, caption, controls, and adjacent-boundary checks before continuing in order. PR #1290 remains draft and all candidates unbound. No provider, spend, merge, deployment, publication, or release occurred.
