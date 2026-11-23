# L08 caption clearance review

Draft PR #1293, `codex/agentified-caption-safety`, on the synthetic guest route `http://127.0.0.1:3121/agentified/learningplan?lesson=L08`. Outbound n8n calls were disabled. No customer data was used.

The initial L08-01 native-caption overlap expanded into multiple L08 teaching-label collisions. The lesson now uses the existing cue-driven caption band below the video for Small, Medium, and Large at 1280×720 and 390×844. The band contains the exact active VTT cue, disappears between cues and when captions are off, and returns with the selected size when captions turn on. Video dimensions and paused time are preserved. The approved video and VTT bindings are unchanged.

`../caption-size-review/receipt.json` records 48 L08 checks: eight scenes, three sizes, two widths. `L08-01-1280-caption-clearance.mp4` and `L08-01-390-caption-clearance.mp4` show the caption size and off/on path through all eight scenes; both passed FFmpeg decode. `walkthrough-state.json` contains the selected sizes, track modes, and cue texts. `visual-audit/` contains the original native-caption comparison and the adjacent L07/L09 boundary checks. `STOP.md` preserves the earlier stop receipt; the subsequent L09–L16 audit and correction are in `../l09-l16-caption-audit/`.

This lane stops at a validated draft PR. The Integration Captain owns captain QA, Human QA, merge, and deployment.
