# Accelerated lesson clear scope QA

Reviewed product commit: `96d7a5d3d37c15e886d1ed10ea76234c08229999`.

Exact localhost route: `http://localhost:3108/accelerated/learningplan?review=96d7a5d3d37c15e886d1ed10ea76234c08229999`.

Rendered guest walkthrough on that local build, using synthetic answers and a dummy localhost Supabase URL. The clips show L01 completed with an answer, a separate L02 answer, the L02 clear action, and L01 still answered with completion unchanged. [capture.cjs](capture.cjs) asserted the complete native confirmation in both viewports:

> Clear only L02 · Prioritize before generating from this device? Your other lesson answers and completion progress will stay. This change will be saved on this device. Any copy already sent for review remains with AmaduTown.

Native dialogs are not included in Playwright's page video.

| Viewport | Walkthrough | Final still |
| --- | --- | --- |
| 1440 × 900 | [desktop.mp4](desktop.mp4) | [desktop.png](desktop.png) |
| 390 × 844 | [mobile.mp4](mobile.mp4) | [mobile.png](mobile.png) |

The focused Vitest suite also exercises guest local storage, a signed-in member POST snapshot, and the Decision File's all-answer delete. No live account, external send, or production data was used.

Both MP4s decoded without error via `ffmpeg -v error -i <file>.mp4 -f null -`. Final stills were inspected for legibility.
