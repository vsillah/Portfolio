# Lesson-order measured-padding stop: L01-05

Status: **STOP / review-only / unbound**. Padding base: draft PR #1290 `e3462078666d0f99596d14a3c4b15649ffa8f8b7`. Caption-clearance dependency: separate draft PR #1293 `6a8006bbbf0ee57416d7339bd0a0e88315403b4a`, whose L01-04 checkpoint clears the previous collision. Its candidate MP4/VTT hashes match the L01-04 candidate on PR #1290. No branch restack or merge occurred.

The next candidate, L01-05, keeps its original art, source video, caption words and timing, audio, and 1280×720 / 390×844 review geometry. The headline and “Source missing” panel fit measured glyphs with 28 px padding. All pixels outside the old/new panel unions are unchanged. Both eight-second review clips decode. `verify-l01-05-stop.py` binds those checks, exact source hashes, both PR heads, and the browser screenshot in `l01-05-stop-receipt.json`.

The **first new visual defect** is at L01-05, lesson time approximately 162.78 seconds. In the desktop review player, the first native English cue crosses the unchanged **“Source missing”** teaching label. The exact caption-on screenshot is `checks/lesson-order/L01-05-desktop-caption-collision.png`. The first cue reads “The rollback is ‘withdraw the draft from the review folder and mark it superseded.’” and spans review time 0.000–1.809 seconds. The cue and label occupy the same image region. The later cue also approaches that label. The generated mobile clip is technical evidence only; mobile visual states were not reviewed after the desktop stop.

Stop before L01-06 and all later scenes. The candidate remains unbound; the approved frame and learner MP4/VTT were not replaced. Consolidated walkthrough and Human QA remain unqualified. The two pre-existing untracked L10 WAVs were left untouched. PR #1290 stays draft and Phase 3B stays HOLD pending a separate exact-head caption clearance for L01-05.

## Reproduction

```bash
node agentified/workshop/presentation-illustration-audit/render-semantic-visuals.mjs --padding-review --scenes=L01-05 --receipt-name=candidate-receipt-L01-05
python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L01-05 desktop
python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L01-05 mobile
python3 agentified/workshop/phase-3b-review/text-panel-padding/verify-l01-05-stop.py
```

Open `checks/lesson-order/review.html?scene=L01-05&layout=desktop` through a local server and play from the start with English captions enabled. This context player is not a learner-route pass.
