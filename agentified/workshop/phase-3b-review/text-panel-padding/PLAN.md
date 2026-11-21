# Agentified text-panel padding audit and correction plan

Status: Phase 3B review-only. Base: PR #1290 `4b3672f1f8cd869b37c058c6db05a0393bd6c8bf`. No learner binding or distribution claim.

## Source inventory and decision rule

`presentation-illustration-audit/semantic-briefs.json` identifies 128 scenes: eight each for L01–L16. `render-semantic-visuals.mjs` is the editable source for their bordered teaching overlays. L01-01 is a separate corrected proposal plate. The approved plate artwork, crop masks, worksheet writing areas, file-page surfaces, diagram frames, and progress bars have structural space and are not text-padding targets. The existing L13-03 unbound correction in `phase-3b-review/L13/render-content-aware-frame.mjs` is the measuring reference and must remain byte-for-byte stable during this audit.

Measure the actual rasterized glyph bounds at 1920×1080. A teaching text container qualifies when one or more of its four effective paddings materially exceeds the 24–32 px reference without serving a functional or source-defined purpose. Preserve wording, type size, natural wrap, and the original source image. Fit each candidate box to its own measured text with about 28 px internal padding. Keep its placement inside the prior box and verify that neither the box nor its text obscures adjacent teaching elements. A geometrically tight box is not sufficient if it breaks the scene composition.

## Lesson-order audit coverage

| Lessons | Scene source | Candidate text containers | Protected or deferred regions |
| --- | --- | --- | --- |
| L01 | Eight semantic scenes | 02–06 headline boxes and labels, 08 labels | 01 separate proposal plate; 07 writing area; 08 file page |
| L02–L04 | Eight semantic scenes per lesson | Headline boxes and labels in 01–06, file labels in 08 where source-faithful | 07 writing areas, 08 file pages, approved plates; no narration generation or media binding |
| L05–L08 | Eight semantic scenes per lesson | Headline boxes and labels in 01–06, file labels in 08 | 07 writing areas, 08 file pages, approved plates and diagram geometry |
| L09–L12 | Eight semantic scenes per lesson | Headline boxes and labels in 01–06, file labels in 08 | 07 writing areas, 08 file pages, existing L09/L10 evidence and caption sources |
| L13 | Eight semantic scenes | 01, 02, 04–06 headline boxes and labels; 08 labels | 03 already corrected in its separate unbound candidate; 07 writing area; 08 file page |
| L14–L16 | Eight semantic scenes per lesson | Headline boxes and labels in 01–06, file labels in 08 | 07 writing areas, 08 file pages, approved plates and L16 resting-card evidence |

## Implementation and gates

1. Generate a per-scene audit receipt from exact briefs and renderer geometry: source hash, container purpose, raster glyph bounds, actual four-side padding, and `correct`, `retain`, or `defer` disposition. Record L02–L04 separately as visual-source-only.
2. Render provider-free candidate frames into a separate review directory in lesson order. Do not overwrite approved source frames or bound media. Preserve L13-03 as the existing corrected candidate and preserve all owner-rights and L09/L13 receipts.
3. Verify each changed frame against its source and measure the new padding. Render desktop and 390×844 caption-off/on contextual review states where source media exists. Stop at the first clipping, wrapping, collision, source ambiguity, or changed audio/caption/timing check.
4. Build a consolidated before/after desktop/mobile MP4 showing representative cases and every corrected state, bound to the exact correction commit. Review it visually before presenting a Human QA gate.

PR #1290 stays draft and Phase 3B stays HOLD until contextual Human QA passes. Provider contact, spending, learner binding, merge, deployment, publication, and release are outside this work.

## Complete measurement audit at base head

`audit.mjs` verified all 128 scene master hashes and measured 276 text containers in the current approved frames. The receipt at `audit-receipt.json` records every scene, source frame hash, rendered glyph bounds, source container bounds, four effective padding values, and an initial disposition. `candidate` means at least one side exceeds 48 px and needs visual judgment; it is not approval to modify that box. The audit found 273 candidates, one within the threshold, and two pre-existing headline overflow failures. L02–L04 each have all eight scenes accounted for as visual sources only; no narration or distribution status is inferred.

| Lesson | Measured containers | Initial candidates | Source clipping |
| --- | ---: | ---: | --- |
| L01 | 16 | 16 | — |
| L02 | 17 | 17 | — |
| L03 | 18 | 17 | — |
| L04 | 18 | 18 | — |
| L05 | 17 | 17 | — |
| L06 | 18 | 17 | L06-03 headline: right padding −17 px |
| L07 | 17 | 17 | — |
| L08 | 17 | 17 | — |
| L09 | 18 | 18 | — |
| L10 | 17 | 16 | L10-03 headline: right padding −19 px |
| L11 | 18 | 18 | — |
| L12 | 17 | 17 | — |
| L13 | 15 | 15 | L13-03 already has its separate unbound correction |
| L14 | 17 | 17 | — |
| L15 | 18 | 18 | — |
| L16 | 18 | 18 | — |

**Stop at the source clipping gate.** `L06-03.png` visibly lets “Source check before action.” cross the right panel border; `L10-03.png` does the same for “Changed terms need new review.” Both are approved plate scenes, so a width change can also encroach on source-defined diagram content. The requested stop-on-clipping rule applies before mass candidate rendering. No approved frames, bound composites, captions, audio, timing, or learner routes have been modified in this audit. The correction phase, consolidated MP4, and Human QA gate remain pending.

## Authorized overflow-repair checkpoint

Vambah authorized review-only overlay repair of L06-03 and L10-03, then a resumed lesson-order pass only if both repaired scenes cleared desktop/mobile caption and control checks. The two measured headline boxes now fit their glyphs with 28 px padding and preserve all pixels outside the headline overlay area. The first L06-03 desktop caption-on context check found an active source cue covering “Prepare” and “Human gate.” See `STOP.md` and `context-check-receipt.json`. The requested stop-on-collision rule applies, so the full padding pass and consolidated MP4 are not yet authorized to advance. These candidate stills and clips are review-only and unbound.

## Resumed lesson-order checkpoint

Separate draft PR #1293 at `c746b96d6076d20f0e605be4ffc7aee7b36b9ddc` cleared L06-03 by placing its desktop cue below the video while preserving the source MP4/VTT. `audit-receipt.json` binds that exact cross-PR dependency without restacking. The first new lesson-order candidate, L01-02, fits its headline and two labels to measured glyphs with 28 px padding. Its desktop Medium native cue covers “Prepare one brief” at approximately lesson second 52. See `L01-02-STOP.md` and the browser screenshot. The full pass and consolidated MP4 remain stopped at this new collision; no L02–L16 candidate has been qualified.
