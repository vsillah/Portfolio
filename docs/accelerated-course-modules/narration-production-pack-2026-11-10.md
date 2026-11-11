# Accelerated L01–L16 narration production pack

**Status:** provider-free text inventory, **blocked for production by native-audio alignment**. The [machine-readable pack](narration-production-pack-2026-11-10.json) contains the approved-script cutaway text, each window’s character and word count, planned timing, text hash, script/request/VTT/native-media hashes, and bounded proposed speech payloads. The [per-window audio audit](../../artifacts/accelerated-visual-parity-2026-11-10/presenter-audio-asr-audit.json) records both full-window recognizers and script-alignment evidence for all 64 current native presenter windows. Neither file is a provider submission or approval; the proposed payloads must not be submitted from this state.

## Method and source binding

The generator reads the fenced narration from the 16 canonical curriculum scripts and matches the four draft presenter-request passages by word sequence. It assigns every script word exactly once across presenter and cutaway windows, then checks that every proposed cutaway starts and ends at a sentence boundary. It verifies the script SHA-256 against the request and the native MP4, current visual MP4, and VTT SHA-256 against the current composite receipt. Run `python3 scripts/qa/build-accelerated-narration-pack.py --check` to detect drift.

The proposed jobs join whole sentence-complete cutaway windows with two newlines and keep each text payload at or below 5,000 characters. The [HeyGen Text to Speech request-field documentation](https://developers.heygen.com/docs/voices/heygen-voice-speech#request-fields) sets that limit for `POST /v3/models/audio/tts`; a separate Platform model card suggests 10,000. The Agentified subscription `create_speech` route and voice support still need read-only verification before any execution. The 5,000-character split is the conservative planning boundary. Agentified’s L01 continuous-narration renderer supplies the method: word timestamps, silence-aware sentence alignment, and native-source composite. Its L01 provider receipt used the same voice ID as the Accelerated presenter, `14b592b937744404a4fa7c01aafd7dbe`, with one request, 8 subscription credits, and $0 cash. Agentified L05–L08 demonstrated a four-job batch under a 40-credit cap, but used a different voice; those receipts support the process, not this course’s voice choice. No separate cash API rate or one-cutaway Turbo Free shortcut is assumed.

## Proposed cutaway windows

Times are the available gaps in the **current native MP4**, before any word-level alignment or deliberate pauses. “ch” counts Unicode characters in the exact proposed text. The final C04 tail exists in L02–L16 and is included in a speech payload. Jobs use whole cutaway windows, so every split is at a sentence boundary. The machine-readable pack holds the exact payload and hash for each job.

| Lesson | Gap / characters | Provider-safe jobs / characters | Historical credit estimate |
| --- | --- | --- | ---: |
| L01 | C01 31.52–235.00 s / 2338 ch<br>C02 248.20–345.00 s / 1178 ch<br>C03 358.96–515.00 s / 1552 ch | J01 C01+C02 / 3518 ch<br>J02 C03 / 1552 ch | 13 |
| L02 | C01 29.76–180.00 s / 1614 ch<br>C02 194.28–366.00 s / 1827 ch<br>C03 376.20–573.88 s / 2201 ch<br>C04 587.24–600.00 s / 80 ch | J01 C01+C02 / 3443 ch<br>J02 C03+C04 / 2283 ch | 15 |
| L03 | C01 22.28–174.00 s / 1607 ch<br>C02 190.84–349.00 s / 1786 ch<br>C03 360.28–513.96 s / 1648 ch<br>C04 526.24–540.00 s / 75 ch | J01 C01+C02 / 3395 ch<br>J02 C03+C04 / 1725 ch | 14 |
| L04 | C01 25.72–165.00 s / 1576 ch<br>C02 178.84–350.00 s / 1862 ch<br>C03 365.24–572.92 s / 2312 ch<br>C04 585.44–600.00 s / 61 ch | J01 C01+C02 / 3440 ch<br>J02 C03+C04 / 2375 ch | 15 |
| L05 | C01 19.24–200.00 s / 2084 ch<br>C02 220.88–400.00 s / 2129 ch<br>C03 414.32–573.92 s / 1928 ch<br>C04 584.96–600.00 s / 127 ch | J01 C01+C02 / 4215 ch<br>J02 C03+C04 / 2057 ch | 17 |
| L06 | C01 20.92–220.00 s / 2060 ch<br>C02 236.80–440.00 s / 2199 ch<br>C03 453.40–630.84 s / 1871 ch<br>C04 646.08–660.00 s / 51 ch | J01 C01+C02 / 4261 ch<br>J02 C03+C04 / 1924 ch | 16 |
| L07 | C01 18.00–200.00 s / 2135 ch<br>C02 214.56–400.00 s / 2046 ch<br>C03 411.92–569.96 s / 1727 ch<br>C04 585.92–600.00 s / 74 ch | J01 C01+C02 / 4183 ch<br>J02 C03+C04 / 1803 ch | 16 |
| L08 | C01 28.52–240.00 s / 2446 ch<br>C02 258.00–480.00 s / 2575 ch<br>C03 495.36–681.04 s / 2157 ch<br>C04 702.80–720.00 s / 122 ch | J01 C01 / 2446 ch<br>J02 C02+C03+C04 / 4858 ch | 20 |
| L09 | C01 22.92–220.00 s / 2249 ch<br>C02 241.16–440.00 s / 2540 ch<br>C03 456.52–630.72 s / 2155 ch<br>C04 645.80–660.00 s / 108 ch | J01 C01+C02 / 4791 ch<br>J02 C03+C04 / 2265 ch | 18 |
| L10 | C01 25.92–180.00 s / 1973 ch<br>C02 199.96–360.00 s / 1966 ch<br>C03 382.20–511.60 s / 1781 ch<br>C04 531.96–540.00 s / 85 ch | J01 C01+C02 / 3941 ch<br>J02 C03+C04 / 1868 ch | 15 |
| L11 | C01 21.48–200.00 s / 2064 ch<br>C02 221.28–400.00 s / 2250 ch<br>C03 422.04–561.56 s / 1584 ch<br>C04 580.68–600.00 s / 159 ch | J01 C01+C02 / 4316 ch<br>J02 C03+C04 / 1745 ch | 16 |
| L12 | C01 24.52–220.00 s / 2100 ch<br>C02 241.28–440.00 s / 2274 ch<br>C03 460.72–622.68 s / 1864 ch<br>C04 645.72–660.00 s / 87 ch | J01 C01+C02 / 4376 ch<br>J02 C03+C04 / 1953 ch | 16 |
| L13 | C01 28.04–226.00 s / 2378 ch<br>C02 246.28–446.00 s / 2529 ch<br>C03 471.68–632.28 s / 1928 ch<br>C04 649.88–660.00 s / 61 ch | J01 C01+C02 / 4909 ch<br>J02 C03+C04 / 1991 ch | 18 |
| L14 | C01 26.28–164.00 s / 1752 ch<br>C02 189.12–330.00 s / 1767 ch<br>C03 352.44–451.32 s / 1226 ch<br>C04 468.48–480.00 s / 119 ch | J01 C01+C02+C03+C04 / 4870 ch | 13 |
| L15 | C01 25.84–243.00 s / 2886 ch<br>C02 267.96–481.00 s / 2835 ch<br>C03 508.84–688.08 s / 2450 ch<br>C04 708.52–720.00 s / 104 ch | J01 C01 / 2886 ch<br>J02 C02 / 2835 ch<br>J03 C03+C04 / 2556 ch | 23 |
| L16 | C01 28.48–161.00 s / 1708 ch<br>C02 187.08–316.00 s / 1663 ch<br>C03 341.40–449.44 s / 1298 ch<br>C04 472.52–480.00 s / 62 ch | J01 C01+C02+C03+C04 / 4737 ch | 12 |

**Total:** 63 cutaways across 31 proposed jobs; 97,517 characters would be submitted. The 30-character difference from the original 16 lesson-level joins comes from omitted two-newline separators at job boundaries. All 31 request payloads are at most 5,000 characters and remain separately hashed. The historical planning estimate is **257 subscription credits**, calculated as one credit per started 400 characters **for each job** from the five Agentified receipts. A **proposed aggregate ceiling of 322 subscription credits** adds a 25% planning allowance. This is not a live price, a provider quote, or an enforced cap. The current connected account, rights for this voice and purpose, actual `create_speech` route limit and voice support, live rounding/fees, subscription balance, no-auto-reload setting, and a fail-closed aggregate limit must be verified before any submission. Cash spend authorization remains **$0**. Stop if the provider cannot enforce the cap or a job’s actual debit cannot be bounded; make no retry or duplicate request. The total is one 16-lesson decision, not 31 separate small-expense decisions.

## Native-audio boundary findings

- **L01 A02 timeline conflict:** both full-window recognizers and a longer native tail identify A02 saying “Let’s make the first page of your decision file” after “public proof.” Word-level recognition places that sentence near **245.13–248.23 s**. The approved script has roughly 185 cutaway words between those sentences. The current candidate also assigns “Let’s make…” to C02, so submitting it would duplicate and reorder speech. The seven-second tail and high token probabilities disprove the earlier assumption that this was only a short-clip hallucination. A source-audio trim near 245.13 s, or another reviewed edit, is required before rehashing L01.
- **L01 A03 → C03:** the request stops at “It could be whether,” while both full-window recognizers identify the native A03 continuing through “offer.” The candidate starts C03 at “Keep the scope small…”. This remains a proposed assignment pending listening and an edit decision.
- **Across the course:** the base and small English models disagree with the candidate at 35 heads and 30 tails (five-word comparison). Long exact script matches indicate **28 possible noncontiguous script jumps** within presenter windows. These are machine diagnostics, not 28 confirmed edits. The VTT is editorially timed and can cross the native cuts. This chat’s media reader omits audio input, so **none of the 64 windows received an audible listening sign-off**. All 64 remain unresolved; the exact evidence for each is in the audit JSON. No candidate cutaway text or timing was changed on machine evidence alone.

**L01 listening checkpoint:** [review-only 03:55–04:12 MP4](../../artifacts/accelerated-visual-parity-2026-11-10/l01-a02-boundary-review-235-252.mp4) with a visible source clock and phase labels. Listen at **04:05.13–04:08.23** for the suspected first-page sentence, then check the **04:08.20** A02→C02 cut. The [render receipt](../../artifacts/accelerated-visual-parity-2026-11-10/l01-a02-boundary-review-235-252.json) binds the source and output hashes and confirms all copied AAC packets match a source extract. The overlay changes video pixels only; the native audio packet payload is unchanged. This excerpt is a review aid, not a listening sign-off or learner asset.

## Exact unresolved presenter windows

For each row in the [audit JSON](../../artifacts/accelerated-visual-parity-2026-11-10/presenter-audio-asr-audit.json), open the `native_source.path` from the corresponding lesson entry in the pack, confirm its SHA-256, and listen across the recorded `start_seconds` and `end_seconds` with context on both sides. Enter the first and last spoken words and the reviewed source hash in `audible_review`; note any trim or reorder decision. Reconcile against the approved script before changing a cutaway span. The ASR transcript and VTT are comparison aids, not the sign-off.

- L01: A01, A02, A03, A04
- L02: A01, A02, A03, A04
- L03: A01, A02, A03, A04
- L04: A01, A02, A03, A04
- L05: A01, A02, A03, A04
- L06: A01, A02, A03, A04
- L07: A01, A02, A03, A04
- L08: A01, A02, A03, A04
- L09: A01, A02, A03, A04
- L10: A01, A02, A03, A04
- L11: A01, A02, A03, A04
- L12: A01, A02, A03, A04
- L13: A01, A02, A03, A04
- L14: A01, A02, A03, A04
- L15: A01, A02, A03, A04
- L16: A01, A02, A03, A04

## Remaining gates

1. Listen to and mark the actual first and last words of all 64 native presenter windows, starting with L01 A02 at 245–248 s. Resolve the possible out-of-order phrases and choose the native trims or other edit treatment against the current source MP4. Then regenerate and rehash the exact texts and timings. Confirm each cutaway fits its gap at the approved voice pace with transition room.
2. Confirm the connected subscription account, voice entitlement and purpose-specific rights, privacy review, current balance, live per-job and aggregate credit quote, and a technically enforced ceiling no higher than the approved aggregate cap. Keep auto-reload and overage off. Obtain one explicit scope-bound production authorization before submission.
3. On authorized production, submit only the reviewed, bounded speech jobs in sequence, no retries. Bind request, output audio, word timestamps, debit receipt, and source hashes. Render and inspect the native composites for no double speech, sentence continuity, captions, pacing, and complete MP4 playback before any later upload or learner rebind decision.

No HeyGen call, generated audio, purchase, credential or billing change, upload, learner rebind, publication, merge, or release occurred in this pack.
