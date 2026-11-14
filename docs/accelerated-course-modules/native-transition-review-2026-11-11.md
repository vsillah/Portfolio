# Accelerated native transition review

**Status:** source-audio and caption-boundary diagnostics for all 16 lessons. The [full timecoded audit](../../artifacts/accelerated-visual-parity-2026-11-10/native-transition-audit/full-l01-l16.json) binds the [full-lesson EDL](full-lesson-timing-decision-list-2026-11-11.md), source MP4 and VTT hashes, per-window ASR flags, 30 scoped local-clip signoffs, measured threshold holds, and every presenter/cutaway boundary. The [L01–L04 checkpoint](../../artifacts/accelerated-visual-parity-2026-11-10/native-transition-audit/tranche-l01-l04.json) is retained as the first tranche. No full presenter window or lesson is signed off by this audit.

## Findings

- The current 63 cutaway spans total **8,380.48 seconds** and contain no activity above the −45 dBFS / 0.12-second silence-detection threshold. This agrees with the earlier un-narrated-source finding; it does not describe a future finished course.
- None of the 64 presenter windows has a measured leading or trailing threshold hold of one second or more. This threshold result is not a listening verdict about pauses, phonemes, or pacing.
- The existing VTT has **64 cues crossing a source presenter/cutaway boundary**. Those are retiming targets, not proven collisions in a final rendered lesson. The source cue spans and exact boundary seconds are in the audit.
- **48 full presenter windows** retain an existing ASR head/tail mismatch. The 30 approved local comparison clips remain signed off at their exact hashes; their approval does not clear the full-window mismatch.
- L05 C02→A03 at **397.58 s**, L06 at **437.72 s**, and L08 at **478.00 s** have **0.00 s planned transition reserve** before the moved native opening. Their local joined clips are approved, while full-lesson placement still needs actual presenter-matched narration.

| Lesson | VTT boundary crossings | ASR full-window mismatches | Cutaway windows below threshold |
| --- | ---: | ---: | ---: |
| L01 | 5 | 3 | 3/3 |
| L02 | 4 | 4 | 4/4 |
| L03 | 4 | 0 | 4/4 |
| L04 | 4 | 3 | 4/4 |
| L05 | 4 | 3 | 4/4 |
| L06 | 4 | 3 | 4/4 |
| L07 | 4 | 3 | 4/4 |
| L08 | 4 | 3 | 4/4 |
| L09 | 4 | 3 | 4/4 |
| L10 | 4 | 4 | 4/4 |
| L11 | 4 | 4 | 4/4 |
| L12 | 4 | 3 | 4/4 |
| L13 | 4 | 3 | 4/4 |
| L14 | 3 | 2 | 4/4 |
| L15 | 4 | 4 | 4/4 |
| L16 | 4 | 3 | 4/4 |

## Bounded native-audio review reel

[Play the 2:05 review reel](../../artifacts/accelerated-visual-parity-2026-11-10/native-transition-audit/native-transition-review-reel.mp4) · [Hash-bound receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-transition-audit/reel-receipt.json) · [Chapter cards](../../artifacts/accelerated-visual-parity-2026-11-10/native-transition-audit/chapter-contact-sheet.png) · [Source frames](../../artifacts/accelerated-visual-parity-2026-11-10/native-transition-audit/source-contact-sheet.png). Five chapters show seven seconds of the **original** native MP4 around a boundary. Three reuse the existing A02→A03 local before/after clips. The source-boundary chapters do not show a candidate edit. Video and audio were re-encoded for the reel; chapter silence was newly encoded. No speech was generated. Full MP4 decode and Chrome playback passed.

| Reel start | Lesson / source time | What to inspect |
| ---: | --- | --- |
| 00:00.00 | L01 · 248.20 s | Existing VTT cue 245.06–252.51 crosses this boundary. |
| 00:09.40 | L02 · 29.76 s | Existing VTT cue 29.48–40.35 crosses this boundary. |
| 00:18.80 | L04 · 365.24 s | Existing VTT cue 355.56–365.67 crosses this boundary. |
| 00:28.20 | L05 · 397.58 s | C02 ends 397.58 · zero planned transition reserve. |
| 00:54.88 | L06 · 437.72 s | C02 ends 437.72 · zero planned transition reserve. |
| 01:21.16 | L08 · 478.00 s | C02 ends 478.00 · zero planned transition reserve. |
| 01:46.60 | L10 · 382.20 s | Existing VTT cue crosses; C03 needs 135.4 wpm. |
| 01:56.00 | L15 · 508.84 s | Existing VTT cue crosses; C03 needs 135.2 wpm. |

The existing VTT cue text is named on the cards but is not burned into the reel. Use the full audit for cue start/end times. The original source excerpts contain the current silent cutaway, while the coordinated clips omit the actual C02 narration. A listener can judge local native phrasing in those clips; they cannot establish the complete transition or final caption synchronization.

## Next gate

Use actual presenter-matched narration for every cutaway, then measure final speech end, transition room, native A03 onset, and VTT cue timing in rendered L01–L16 lessons. Stop L05/L06/L08 if the final C02 voice plus a deliberate transition cannot fit before the moved opening. No provider call, audio synthesis, canonical edit, learner rebind, merge, or release was performed here.
