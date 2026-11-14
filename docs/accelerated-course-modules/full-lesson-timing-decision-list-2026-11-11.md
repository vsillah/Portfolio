# Accelerated full-lesson timing decision list

**Status:** review-only arithmetic schedule, not a rendered or voice-qualified lesson edit. The [source-bound decision JSON](../../artifacts/accelerated-visual-parity-2026-11-10/full-lesson-timing-decisions.json) records the exact source, script, VTT, candidate, and approval hashes for all 16 lessons. It retains every approved cutaway sentence and the existing 31 speech payloads. Canonical media and learner bindings are untouched.

The [24-cut listening receipt](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/human-listening-receipt-2026-11-11.json) binds Vambah’s local-cut approval to PR #1270 commit `31b05313e98376da9b2a29d2e12d7cc8983b22cc`. The earlier [six-clip receipt](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/human-listening-receipt-2026-11-11.json) remains bound to `9aaf109874a9ef4f302233aeb07914a88af4493e`. Neither receipt signs off full presenter windows or full lessons. The alternate L05/L06/L08 A02 packet cuts receive only local-cut approval; the coordinated A02→A03 joins govern those three sentences.

## Decision matrix

| Lesson | Native edit actions | Tightest cutaway rate | Timing decision |
| --- | ---: | ---: | --- |
| L01 | 1 | C01 122.1 wpm | isolated native cuts; source window lengths retained |
| L02 | 3 | C01 117.4 wpm | isolated native cuts; source window lengths retained |
| L03 | 0 | C02 115.0 wpm | no signed-off native trim in this lesson |
| L04 | 2 | C01 121.0 wpm | isolated native cuts; source window lengths retained |
| L05 | 3 | C02 125.3 wpm | coordinated C02→A03; zero transition reserve |
| L06 | 3 | C03 112.3 wpm | coordinated C02→A03; zero transition reserve |
| L07 | 0 | C02 115.5 wpm | no signed-off native trim in this lesson |
| L08 | 3 | C02 114.9 wpm | coordinated C02→A03; zero transition reserve |
| L09 | 2 | C02 127.3 wpm | isolated native cuts; source window lengths retained |
| L10 | 3 | C03 135.4 wpm | isolated native cuts; source window lengths retained |
| L11 | 2 | C02 126.2 wpm | isolated native cuts; source window lengths retained |
| L12 | 2 | C02 113.8 wpm | isolated native cuts; source window lengths retained |
| L13 | 2 | C02 122.0 wpm | isolated native cuts; source window lengths retained |
| L14 | 1 | C01 125.5 wpm | isolated native cuts; source window lengths retained |
| L15 | 2 | C03 135.2 wpm | isolated native cuts; source window lengths retained |
| L16 | 2 | C01 133.6 wpm | isolated native cuts; source window lengths retained |

The action count includes three alternate packet cuts that are **not** selected for sentence continuity, plus the coordinated actions that replace their timing choice. L01 A02 is the previously owner-confirmed isolated cut. The decision JSON gives all P01–P04 spans, C01–C04 spans where present, source-to-target native audio spans, and the nearest existing VTT cue boundaries. Those VTT cues are source references; final captions still need retiming against actual narration.

## Coordinated C02→A03 placement

| Lesson | A02 ends | C02 runs | Moved native opening | Original A03 resumes | Unallocated transition time |
| --- | ---: | --- | --- | ---: | ---: |
| L05 | 218.46s | 218.46–397.58s | 397.58–400.00s | 400.00s | 0.00s |
| L06 | 234.52s | 234.52–437.72s | 437.72–440.00s | 440.00s | 0.00s |
| L08 | 256.00s | 256.00–478.00s | 478.00–480.00s | 480.00s | 0.00s |

C02 keeps its approved word count, text hash, and planned duration. Its earlier placement makes room for the native sentence opening, while the original A03 resumes at its old timestamp. This gives **no planned transition reserve**; any pause, crossfade, or slower final voice needs a separate timing decision.

## Validation and remaining gates

- All 16 source scripts, native MP4s, current visual MP4s, captions, presenter requests, signoff clips, and edit receipts match their recorded hashes. Script windows cover every approved word exactly once and in order; all 31 speech jobs retain their text hashes and stay within 5,000 characters.
- Scheduled presenter audio spans do not overlap each other or cutaway windows. Every planned cutaway duration is positive. Isolated packet and PCM edits keep the nominal window length with silence; the three coordinated moves use the reviewed source audio only.
- Required cutaway rates range from the matrix values up to 135.4 wpm. The three L01 provisional macOS system-voice samples measured 150.2, 154.3, and 169.6 raw wpm. This is a feasibility screen only. It does not measure the selected presenter-matched voice, its pauses, transitions, or caption timing.
- No exact timing contradiction was found that warrants a new preview clip. Actual final narration audio is required before any lesson can pass timing fit or caption synchronization. L05/L06/L08 must explicitly gain transition room or confirm a fit at the final pace; the current schedule has zero spare time there.

No new audio was synthesized. No provider call, spend, upload, learner rebind, canonical edit, merge, or release is authorized by this decision list.
