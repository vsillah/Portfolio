# L02–L16 visual-text cleanup checkpoint

Status: review only. This packet samples the current 15 lesson visual MP4s, not the canonical lesson media. The [scene audit](audit.json) binds every sampled scene to its current MP4, approved script, caption VTT, rendered frame, time range, and SHA-256. Four [contact sheets](current-mp4-contact-sheet-01.png) cover all 92 scenes (24, 24, 24, and 20 scenes).

## Findings and timecoded cleanup list

The shared renderer puts a scene code at the upper right, repeats the learner-artifact name at the lower left, and draws progress dots near the lower edge. These elements appear across all 92 L02–L16 scenes. The existing `clean=True` render path already removes them. The production handoff calls for their removal; the approved scene title and concept content can remain. Source: `scripts/qa/render-accelerated-visual-parity.py` `render()` and `docs/accelerated-course-modules/visual-production/README.md`.

| Lesson | Current scenes | Additional cleanup at source time |
| --- | ---: | --- |
| L02 | 7 | L02-04, 273–366s: dense priority card; simplify for caption review. |
| L03 | 6 | Shared shell only. |
| L04 | 7 | Shared shell only. |
| L05 | 6 | L05-01, 0–100s: dense card. L05-02, 100–200s: feedback table contains `F05 · source note pending` and `F06 · source note pending`; replace with approved evidence or remove the rows before any production render. |
| L06 | 6 | L06-02, 110–220s: dense card. |
| L07 | 6 | L07-02, 100–200s: dense card. |
| L08 | 6 | Shared shell only; L08-01, 0–12s is the representative candidate. |
| L09 | 6 | L09-02, 110–220s: dense card. |
| L10 | 6 | Shared shell only. |
| L11 | 6 | Shared shell only. |
| L12 | 6 | L12-01, 0–110s: dense card. |
| L13 | 6 | Shared shell only. |
| L14 | 6 | Shared shell only. |
| L15 | 6 | Shared shell only. |
| L16 | 6 | Shared shell on non-ending scenes; end-screen treatment belongs to the separate parity lane. |

The dense-card flag is a triage signal based on renderer layout or label count. The [current L05-02 frame](l05-02-current-frame.png) shows the clearest internal-copy leak. The audit JSON lists every exact scene range, source hash, caption-cue count, and longest overlapping cue. It does not claim that every flagged card has failed a full playback review.

## Representative before and after

The [24-second comparison MP4](l08-01-clean-shell-before-after.mp4) presents the current L08-01 first 12 seconds, then the clean-shell candidate for the same 12 seconds. The candidate uses the existing clean render path, the approved scene title, unchanged native presenter pixels from the approved source MP4, and native presenter speech. It removes the scene code, repeated artifact footer, and progress dots. No new learner-facing words or generated voice were added. The [candidate receipt](l08-01-clean-shell-receipt.json) records source and output hashes, frame comparison, decode result, and exact composition method. The [caption review page](l08-01-caption-review.html) loads both clips with the current L08 VTT at 8s.

At desktop 1728×962 and mobile 390×844 (350px player), browser review showed native captions crossing the existing lower footer area. The clean candidate removes that competing footer and dots; its title and presenter face remained clear. Paused browser controls obscure part of the caption, so this checks layout only. Full lesson playback, final caption timing, and the narration mix remain separate gates.

## Scope and next gate

This packet changes only QA scripts and review artifacts. It does not alter `public/accelerated` media, canonical lesson bindings, provider state, learner copy, or the end-screen parity lane. A production pass should apply the shared clean shell across L02–L16, resolve L05-02's pending-source rows against approved evidence, simplify flagged cards scene by scene, then inspect the rendered lesson MP4s with captions at desktop and mobile widths. Re-run the source-bound audit against those new exact outputs before promotion.
