# Agentified L09–L16 caption clearance

Draft PR #1293 on `codex/agentified-caption-safety`. This packet extends the L08 clearance work. The local, synthetic guest route was `http://127.0.0.1:3121/agentified/learningplan?lesson=L09` through `L16`, with outbound n8n disabled. The videos, VTT files, narration, art, presenter, and learner records were not edited.

## Why the caption band is used

`raw-audit.json` records the approved source cue and paused video geometry at each scene boundary and midpoint. `L09-*-contact.jpg` through `L16-*-contact.jpg` show the original desktop native captions. The paired `*-on.jpg` and `*-off.jpg` frames preserve the visual comparison. Native captions visibly covered teaching content in every lesson:

`scripts/qa/capture-agentified-caption-audit.mjs` produced this before-state evidence against the parent commit; its native-caption precondition intentionally fails after the clearance change.

| Lesson | Example collision |
| --- | --- |
| L09 | L09-01 headline, “Count supported work, not drafts.” |
| L10 | L10-01 and L10-02 teaching text and lower chips |
| L11 | L11-02 and L11-03 teaching labels and workbook fields |
| L12 | L12-03 “Scoped receipt” and “Decision” chips |
| L13 | L13-01 “An idea is still a proposal” headline |
| L14 | L14-01 “The board needs three connections” headline |
| L15 | L15-02 “Brief” and “Work” chips |
| L16 | L16-01 “Audit the gaps before release” headline |

The existing cue-driven band is therefore used throughout L08–L16 at desktop Small and Medium, as it already was on mobile and at Large. It shows the original active VTT cue below the player, disappears in cue gaps and when captions are off, and leaves video geometry unchanged. L07 retains native desktop captions. The approved L08 visual stop and its resolution are in `../l08-caption-clearance-review/`.

## Review artifacts

- `clearance-receipt.json`: desktop and 390×844 boundary/midpoint checks for all 64 L09–L16 scenes, including source cue equality, hidden native track, exactly one band for an active cue, no band in gaps, band below video, and no horizontal overflow. The first scene of each lesson also checks off/on and paused geometry.
- `L09-01-boundary-1280-on.jpg` and corresponding `*-390-on.jpg` files: corrected scene captures with the video and cue band together. Every scene has boundary and midpoint captures at both widths.
- `L09-corrected-1280-contact.jpg` through `L16-corrected-1280-contact.jpg`, plus the matching `*-390-contact.jpg` sheets: one-page views of the eight corrected boundary scenes per lesson at each width.
- `L09-L16-1280-caption-clearance.mp4` and `L09-L16-390-caption-clearance.mp4`: short contextual walkthroughs across the eight lessons, including the L09 Small/Medium/Large and off/on path. `walkthrough-state.json` records exact cue text, time, size, and track mode.

The L16 mobile page has a 404 px document scroll width at a 390 px viewport both with captions on and off. The caption band is inside the 292 px video lane and does not increase that existing width; the clearance check compares each scene to its lesson's initial scroll width. The separate page overflow remains outside this caption-placement scope.

Run `node scripts/qa/verify-agentified-caption-clearance.mjs` to regenerate the clearance receipt and corrected captures. Run `node scripts/qa/record-agentified-caption-clearance.mjs` to regenerate the two MP4s. Both MP4s were decoded with FFmpeg after recording.

This is a draft PR review packet. The Integration Captain owns captain QA, Human QA, merge, and deployment.
