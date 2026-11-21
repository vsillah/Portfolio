# Lesson-order measured-padding stop: L01-04

Status: **STOP / review-only / unbound**. Padding base: draft PR #1290 `16f26aa19411e8303f9cdad5b6c4ad5f1d4fb824`. Caption-clearance dependency: separate draft PR #1293 `5aab9acd8f464684706649566aa6b1e368188726`, which clears the preceding L01-02 candidate. Neither branch was restacked or merged.

L01-03 is the next candidate after that clearance. Its 28 px fitted panels, source hashes, 1280×720 and 390×844 eight-second review clips, and preserved pixels outside the panel unions pass `verify-l01-04-stop.py`. In the review player, the active desktop caption clears the lower headline; the mobile context places the caption in the blank area below the art. These are candidate-context checks, not a full learner-route or Human QA pass.

The first new defect appears at **L01-04, lesson time about 128.43 seconds**, in the 1280×720 desktop review context. The first native English caption cue covers both lower teaching labels, **“Receipt fields”** and **“Human gate.”** The exact browser screenshot is `checks/lesson-order/L01-04-desktop-caption-collision.png`; the eight-second MP4 and trimmed VTT are beside it. The L01-04 candidate frame itself has fitted panels and unchanged pixels outside the panel unions. This is a caption placement collision, so the requested stop condition applies before evaluating later scenes. The generated L01-04 mobile clip is technical evidence only; its contextual visual states were not reviewed after the desktop stop.

The machine-readable `l01-04-stop-receipt.json` binds candidate frames, clips, VTTs, screenshot, source media, and both PR heads by SHA-256. Review-only outputs do not replace approved frames, learner MP4/VTT, or binding receipts. L01-05 through L16, a consolidated walkthrough, and Human QA remain unqualified. The two pre-existing untracked L10 WAVs were not touched.

## Reproduction

```bash
node agentified/workshop/presentation-illustration-audit/render-semantic-visuals.mjs --padding-review --scenes=L01-03,L01-04 --receipt-name=candidate-receipt-L01-03-L01-04
python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L01-04 desktop
python3 agentified/workshop/phase-3b-review/text-panel-padding/verify-l01-04-stop.py
```

Open `checks/lesson-order/review.html?scene=L01-04&layout=desktop` through a local server and play from the start with English captions enabled. PR #1290 stays draft and Phase 3B stays HOLD pending a separate exact-head caption clearance for L01-04.
