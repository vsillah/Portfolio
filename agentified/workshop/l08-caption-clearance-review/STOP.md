# L08 caption placement and adjacent L09 — local stop

**Historical stop, superseded by the L09–L16 audit and correction in `../l09-l16-caption-audit/`.** The facts below describe the earlier local checkpoint, before the subsequent authorization, tests, and draft PR update.

Draft PR #1293 remains at `404656cca67eb48d57261520a1a54179ed87095e`. No new commit or push was made. The current local, uncommitted patch routes all L08 cues through the existing external caption band, with no band between cues or when captions are off. Approved media, VTT text/timing, video geometry, controls, and learner data were not edited.

## Earlier visual stops

- L08-01 at 00:12.717: native caption covered “A handoff must be testable.” The L08-01 local band correction cleared it.
- L08-03 at 01:07.348: native caption covered “Staffing claim.” The user authorized a bounded L08-03 extension.
- The next adjacent sweep found native overlaps in L08-02 (“Payload” / “Reject rule”) and L08-04 (“Evaluate” / “Human sample”). The user then authorized a lesson-level L08 band rule.

## Current stop: L09-01 boundary

The lesson-level L08 rule passed 68 focused tests and a read-only DOM/geometry audit of 40 caption states: both audited samples in each of eight L08 scenes, plus L07-08 and L09-01, at 1280×720 and 390×844. Active L08 cues appeared once below the video, cue gaps had no band, and off/on preserved paused time and video dimensions. This audit is **not** sufficient visual qualification.

The desktop visual contact sheets revealed a further overlap in adjacent L09-01. At 00:01.500, the native cue “Harbor Learning Circle has three neat classroom briefs on a table.” crosses the source headline “Count supported work, not drafts.” At 00:15.910, another native cue covers the same headline. The captions-off captures reveal the full text. Exact evidence:

- `visual-audit/L09-01-boundary-1280-on.png` and `visual-audit/L09-01-boundary-1280-off.png`
- `visual-audit/L09-01-midpoint-1280-on.png` and `visual-audit/L09-01-midpoint-1280-off.png`
- `visual-audit/contact-boundary-1280.png` and `visual-audit/contact-midpoint-1280.png`

The 390×844 captures were generated but have not been visually signed off after this stop. The complete shared-caption verifier was **not rerun** after the lesson-level change. Contextual MP4s were **not regenerated** for that change. The local L08 packet is on hold, and PR #1293 was not advanced.

Next decision: authorize a separate L09-01 caption-placement correction or direct a narrower treatment, then repeat visual review of L07/L08/L09 and the full validation. Do not infer that the rest of L09 is clear. No merge, deployment, provider call, spend, publication, or release occurred.
