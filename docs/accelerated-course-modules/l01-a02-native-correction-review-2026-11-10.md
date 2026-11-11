# L01 A02 native correction candidate and jump triage

**Status:** no-provider, review-only media candidate. The canonical 09:00 L01 MP4 remains unchanged. Neither the source captions nor the 63 cutaway texts and 31 proposed speech payloads were revised. This artifact isolates one suspected chronology correction; it is not a learner asset or audible sign-off.

## Review media

- [Before: original source excerpt](../../artifacts/accelerated-visual-parity-2026-11-10/l01-a02-boundary-review-235-252.mp4) — source 03:55–04:12, visible clock and boundary labels.
- [After: native trim candidate](../../artifacts/accelerated-visual-parity-2026-11-10/l01-a02-native-trim-candidate-235-252.mp4) — same 17-second span; A02 ends at the AAC packet boundary **04:05.133333**. From that point, the already-existing C02 card is shown and silent AAC packets are copied from source 04:09–04:15.87.
- [Sequential before/after MP4](../../artifacts/accelerated-visual-parity-2026-11-10/l01-a02-before-after-235-252.mp4) — 34 seconds, first 17 seconds original and second 17 seconds corrected. Its audio is decoded and re-encoded only for convenient playback; the isolated candidate above is the packet-preserving review artifact.
- [Render receipt](../../artifacts/accelerated-visual-parity-2026-11-10/l01-a02-native-trim-candidate-235-252.json) — binds source/output hashes and packet checks. The [render script](../../scripts/qa/build-l01-a02-correction-candidate.py) reproduces the edit.

**Canonical source SHA-256:** `ee09bf72887ca7507229b86f89c4b81b21ba4f97f3290b3451ca704506e7991a`.
**Candidate SHA-256:** `6a689800eeb442659df40746fe351f471f5c110d51e2c6005a95b52e5f3bc676`.
**Before/after SHA-256:** `cb7d6cfbdb5a16e0afeccc7765a432899df3bd3bbdea4a4345e3f3f4144e41a9`.

## Validation and uncertainty

- The isolated candidate contains **476 retained native AAC packets** before the cut and **323 copied native silence packets** after it. Their payload hashes match the source extracts in order; the candidate mux changed none of those packets. The silent source region measured **−91.0 dBFS**; the original suspect passage at relative 10.25–13.05 seconds measured **−28.8 dBFS**, versus **−91.0 dBFS** after the edit.
- Independent local `ggml-base.en` and `ggml-small.en` full-clip transcriptions of the candidate both end at “public proof.” Neither includes “Let’s make the first page of your decision file.” This is machine evidence; the approved script and native source remain the authority.
- FFmpeg decoded both complete MP4s. The candidate is 17.0 seconds and the sequential comparison is 34.0 seconds. Frames at source 04:05 and 04:08 and the comparison’s after segment were inspected for legible labels, correct card, and no silent talking-head hold.
- **Residual uncertainty:** 04:05.133333 follows machine word timing and an AAC packet boundary. An audio-capable reviewer must confirm that “public proof” ends cleanly and no phoneme of the next sentence survives. The full-lesson composite, C02 planned start time, captions, and speech payload hashes stay blocked until that decision. This candidate only changes the isolated review excerpt.

## Remaining suspected script jumps by lesson

The [triage JSON](../../artifacts/accelerated-visual-parity-2026-11-10/presenter-jump-triage.json) classifies the **28 flagged jumps as machine-high-confidence structural conflicts**, with **0 likely ASR noise** within that flagged subset. Both full-window models align each later phrase across at least 40 script words, and the measured phrase has substantial source audio energy. The two models share an architecture, so these are review priorities, not final edit points or audible sign-offs. Other head/tail discrepancies outside this subset remain in the [64-window audit](../../artifacts/accelerated-visual-parity-2026-11-10/presenter-audio-asr-audit.json).

| Lesson | Flagged presenter windows | Next action |
| --- | --- | --- |
| L01 | A02 | Review the 04:05.13 candidate cut in the before/after clip; then check A01, A03, and A04. |
| L02 | A01, A02, A03 | Listen to A01, A02, A03 and choose native trims or intentional sequence before synthesis. |
| L03 | None | No machine-supported jump; still listen to all four presenter boundaries before sign-off. |
| L04 | A02, A03 | Listen to A02, A03 and choose native trims or intentional sequence before synthesis. |
| L05 | A01, A02 | Listen to A01, A02 and choose native trims or intentional sequence before synthesis. |
| L06 | A01, A02 | Listen to A01, A02 and choose native trims or intentional sequence before synthesis. |
| L07 | None | No machine-supported jump; still listen to all four presenter boundaries before sign-off. |
| L08 | A01, A02 | Listen to A01, A02 and choose native trims or intentional sequence before synthesis. |
| L09 | A03, A04 | Listen to A03, A04 and choose native trims or intentional sequence before synthesis. |
| L10 | A01, A03, A04 | Listen to A01, A03, A04 and choose native trims or intentional sequence before synthesis. |
| L11 | A03, A04 | Listen to A03, A04 and choose native trims or intentional sequence before synthesis. |
| L12 | A03, A04 | Listen to A03, A04 and choose native trims or intentional sequence before synthesis. |
| L13 | A01, A02 | Listen to A01, A02 and choose native trims or intentional sequence before synthesis. |
| L14 | A04 | Listen to A04 and choose native trims or intentional sequence before synthesis. |
| L15 | A01, A03 | Listen to A01, A03 and choose native trims or intentional sequence before synthesis. |
| L16 | A01, A02 | Listen to A01, A02 and choose native trims or intentional sequence before synthesis. |

No HeyGen call, narration generation, credit spending, learner upload or rebind, merge, or release occurred.
