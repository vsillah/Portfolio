# L01-08 safe sample and caption-over-card stop

Status: **STOP / review-only / unbound**. Padding base: draft PR #1290 `11f60c302d4f7bbf998be8a5d198e6600dd101aa`. Caption dependency: separate draft PR #1293 `77eb44c6232bf1095e267a24fcf6c6ec52aeaf00`. These exact heads were verified before the correction. No branch restack or merge occurred.

The L01-08 QA sample now starts four seconds into the scene, at lesson second 347.059, and ends at 355.059. It clears the protected approved branded end screen, which starts at 359.645. Only `render-scene-context.py` sampling changed. Both 1280×720 desktop and 390×844 mobile review clips decode, retain the exact source audio segment and caption words, and remain unbound. The candidate frame has 28 px fitted “Workflow” and “Receipt” panels; all pixels outside the old/new panel unions remain identical to the original. Source MP4 and VTT hashes match the exact source map. `verify-l01-08-resume-stop.py` binds the clip, frame, source, browser screenshots, safe sample window, and both PR heads in `l01-08-resume-stop-receipt.json`.

The first new visual failure is in the **desktop candidate, paused at review time about 2.77 seconds**. Its native two-line caption crosses the blank lower field and bottom edge of the Operating File card. “Workflow” and “Receipt” remain legible, but the caption occupies the card itself. The exact browser frame is `checks/lesson-order/L01-08-desktop-paused-caption-collision.png`. The mobile cue is outside the art in `L01-08-mobile-paused-caption-on.png`; toggling it off while paused removed the cue without moving the art. Desktop caption-off and mobile paused caption-off screenshots are also retained. This is a caption/art collision, so the lesson-order sweep stops before L02-01.

The previously recorded L01-06 active-cue desktop/mobile frames remain clear. Its candidate caption-off, Aa, theme, and control-interaction matrix was not completed before this stop. L01-07 remains an unchanged protected worksheet frame; its whole-scene matrix is not complete. PR #1293's existing learner-route receipt covers source media and adjacent L01 scene states, but does not bind these new L01-08 candidate clips to the learner route. No consolidated walkthrough or Human QA was produced. The two pre-existing untracked L10 WAVs were untouched. PR #1290 remains draft and Phase 3B remains HOLD.

## Reproduction

```bash
python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L01-08 desktop
python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L01-08 mobile
python3 agentified/workshop/phase-3b-review/text-panel-padding/verify-l01-08-resume-stop.py
```

Open `checks/lesson-order/review.html?scene=L01-08&layout=desktop` through a local server, play to about 2.8 seconds, pause with English captions on, and inspect the lower Operating File card. The review player is not a learner-route pass. The next gate is a separate exact-head caption clearance for L01-08 before the padding audit resumes.
