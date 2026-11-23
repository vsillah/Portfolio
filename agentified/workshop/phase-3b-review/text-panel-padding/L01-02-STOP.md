# Lesson-order measured-padding stop: L01-02

Status: **STOP / review-only / unbound**. Padding base: PR #1290 `519918b9df23ae012d5c20c700ffb8a696775afb`. Caption-clearance dependency: separate draft PR #1293 `c746b96d6076d20f0e605be4ffc7aee7b36b9ddc` for L06-03 only. No branch restack or merge occurred.

The cross-PR L06-03 checkpoint is bound in `audit-receipt.json` to the exact learner source video SHA-256 `163e01e6eb8f1a014b7155b40063bc2b6fa3546fc6bc4329579775581e6f9ef3` and VTT SHA-256 `018418cc1d4bf2333ed6525f1926b8b052f57677a136976e42c80c8f703c69ba`. Its corrected stacked learner route places the L06-03 active cue in an external band below the video. That behavior does not extend to L01 desktop Medium captions.

L01-01 uses its separate approved proposal plate, so L01-02 is the first new content-aware candidate in lesson order. Its exact source master, original frame, source video, and VTT hashes are recorded in `audit-receipt.json` and the source map. The review-only render fits the L01-02 headline to 596×197 px, “Prepare one brief” to 417×97 px, and “Morgan decides” to 386×98 px, each with 28 px effective glyph padding. Text words, font hierarchy, line breaks, approved source art, and other pixels outside the original/new panel unions are unchanged. The desktop and 390×844 eight-second context MP4s decode and retain the source caption words and source audio segment; they do not replace the learner media.

At lesson time approximately 52 seconds, the L01-02 desktop Medium caption is native in-video and covers the unchanged “Prepare one brief” teaching label. The exact browser screenshot is `checks/lesson-order/L01-02-desktop-caption-on-stop.png`. This is the next caption/teaching-content collision, so the requested stop condition applies. The other L01 candidates, L02–L16 padding corrections, consolidated desktop/mobile walkthrough, and Human QA are **not qualified**. L02–L04 remain audit-only visual sources with no narration or distribution claim.

## Reproduction

```bash
node agentified/workshop/phase-3b-review/text-panel-padding/audit.mjs
node agentified/workshop/presentation-illustration-audit/render-semantic-visuals.mjs --padding-review --scenes=L01-02 --receipt-name=candidate-receipt-L01-02
python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L01-02 desktop
python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L01-02 mobile
```

Open `checks/lesson-order/review.html?scene=L01-02&layout=desktop` through the local server, play to about 0:02 with English captions on, and inspect “Prepare one brief” beneath the native cue. The review page is not a learner-route pass. The approved learner MP4/VTT, owner-release receipt, L09/L13 review evidence, and two pre-existing untracked L10 WAVs remain untouched. PR #1290 stays draft and Phase 3B stays HOLD.
