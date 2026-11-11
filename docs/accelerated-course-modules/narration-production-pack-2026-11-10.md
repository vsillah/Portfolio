# Accelerated L01–L16 narration production pack

**Status:** provider-free review candidate. The [machine-readable pack](narration-production-pack-2026-11-10.json) contains the complete approved-script cutaway text, each window’s exact character and word count, planned timing, text hash, script/request/VTT/native-media hashes, and one joined speech payload per lesson. The [audio audit](../../artifacts/accelerated-visual-parity-2026-11-10/presenter-audio-asr-audit.json) records the 64 current native presenter windows. Neither file is a provider submission or approval.

## Method and source binding

The generator reads the fenced narration from the 16 canonical curriculum scripts and matches the four draft presenter-request passages by word sequence. It assigns every script word exactly once across presenter and cutaway windows, then checks that every proposed cutaway starts and ends at a sentence boundary. It verifies the script SHA-256 against the request and the native MP4, current visual MP4, and VTT SHA-256 against the current composite receipt. Run `python3 scripts/qa/build-accelerated-narration-pack.py --check` to detect drift.

One proposed `create_speech` job per lesson joins its cutaway windows with two newlines. Agentified’s L01 continuous-narration renderer supplies the method: word timestamps, silence-aware sentence alignment, and native-source composite. Its L01 provider receipt used the same voice ID as the Accelerated presenter, `14b592b937744404a4fa7c01aafd7dbe`, with one request, 8 subscription credits, and $0 cash. Agentified L05–L08 demonstrated a four-job batch under a 40-credit cap, but used a different voice; those receipts support the process, not this course’s voice choice. No separate cash API rate or one-cutaway Turbo Free shortcut is assumed.

## Proposed cutaway windows

Times are the available gaps in the **current native MP4**, before any word-level alignment or deliberate pauses. “ch” counts Unicode characters in the exact proposed text. The final C04 tail exists in L02–L16 and is included in the speech payload.

| Lesson | Gap / characters | Joined characters | Historical credit estimate |
| --- | --- | ---: | ---: |
| L01 | C01 31.52–235.00 s / 2338 ch<br>C02 248.20–345.00 s / 1178 ch<br>C03 358.96–515.00 s / 1552 ch | 5072 | 13 |
| L02 | C01 29.76–180.00 s / 1614 ch<br>C02 194.28–366.00 s / 1827 ch<br>C03 376.20–573.88 s / 2201 ch<br>C04 587.24–600.00 s / 80 ch | 5728 | 15 |
| L03 | C01 22.28–174.00 s / 1607 ch<br>C02 190.84–349.00 s / 1786 ch<br>C03 360.28–513.96 s / 1648 ch<br>C04 526.24–540.00 s / 75 ch | 5122 | 13 |
| L04 | C01 25.72–165.00 s / 1576 ch<br>C02 178.84–350.00 s / 1862 ch<br>C03 365.24–572.92 s / 2312 ch<br>C04 585.44–600.00 s / 61 ch | 5817 | 15 |
| L05 | C01 19.24–200.00 s / 2084 ch<br>C02 220.88–400.00 s / 2129 ch<br>C03 414.32–573.92 s / 1928 ch<br>C04 584.96–600.00 s / 127 ch | 6274 | 16 |
| L06 | C01 20.92–220.00 s / 2060 ch<br>C02 236.80–440.00 s / 2199 ch<br>C03 453.40–630.84 s / 1871 ch<br>C04 646.08–660.00 s / 51 ch | 6187 | 16 |
| L07 | C01 18.00–200.00 s / 2135 ch<br>C02 214.56–400.00 s / 2046 ch<br>C03 411.92–569.96 s / 1727 ch<br>C04 585.92–600.00 s / 74 ch | 5988 | 15 |
| L08 | C01 28.52–240.00 s / 2446 ch<br>C02 258.00–480.00 s / 2575 ch<br>C03 495.36–681.04 s / 2157 ch<br>C04 702.80–720.00 s / 122 ch | 7306 | 19 |
| L09 | C01 22.92–220.00 s / 2249 ch<br>C02 241.16–440.00 s / 2540 ch<br>C03 456.52–630.72 s / 2155 ch<br>C04 645.80–660.00 s / 108 ch | 7058 | 18 |
| L10 | C01 25.92–180.00 s / 1973 ch<br>C02 199.96–360.00 s / 1966 ch<br>C03 382.20–511.60 s / 1781 ch<br>C04 531.96–540.00 s / 85 ch | 5811 | 15 |
| L11 | C01 21.48–200.00 s / 2064 ch<br>C02 221.28–400.00 s / 2250 ch<br>C03 422.04–561.56 s / 1584 ch<br>C04 580.68–600.00 s / 159 ch | 6063 | 16 |
| L12 | C01 24.52–220.00 s / 2100 ch<br>C02 241.28–440.00 s / 2274 ch<br>C03 460.72–622.68 s / 1864 ch<br>C04 645.72–660.00 s / 87 ch | 6331 | 16 |
| L13 | C01 28.04–226.00 s / 2378 ch<br>C02 246.28–446.00 s / 2529 ch<br>C03 471.68–632.28 s / 1928 ch<br>C04 649.88–660.00 s / 61 ch | 6902 | 18 |
| L14 | C01 26.28–164.00 s / 1752 ch<br>C02 189.12–330.00 s / 1767 ch<br>C03 352.44–451.32 s / 1226 ch<br>C04 468.48–480.00 s / 119 ch | 4870 | 13 |
| L15 | C01 25.84–243.00 s / 2886 ch<br>C02 267.96–481.00 s / 2835 ch<br>C03 508.84–688.08 s / 2450 ch<br>C04 708.52–720.00 s / 104 ch | 8281 | 21 |
| L16 | C01 28.48–161.00 s / 1708 ch<br>C02 187.08–316.00 s / 1663 ch<br>C03 341.40–449.44 s / 1298 ch<br>C04 472.52–480.00 s / 62 ch | 4737 | 12 |

**Total:** 63 cutaways, 97,547 joined characters, 16 proposed jobs. The historical planning estimate is 251 subscription credits, calculated as one credit per started 400 characters in each job from the five Agentified receipts. A **proposed aggregate ceiling of 314 subscription credits** adds a 25% planning allowance. This is not a live price, a provider quote, or an enforced cap. The current connected account, rights for this voice and purpose, live rounding/fees, subscription balance, no-auto-reload setting, and a fail-closed aggregate limit must be verified before any submission. Cash spend authorization remains **$0**. Stop if the provider cannot enforce the cap or a job’s actual debit cannot be bounded; make no retry or duplicate request. The total is one 16-lesson decision, not 16 separate small-expense decisions.

## Native-audio boundary findings

- **L01 C02 → A03:** the draft request starts A03 with “Let’s make the first page of your decision file.” The native A03 head starts with “It starts with a decision, not a tool.” The pack moves the first sentence to C02. Native A02 still ends at “public proof,” so C02 starts “Before you try any prompt…”
- **L01 A03 → C03:** the request stops at “It could be whether,” but the isolated native tail completes the example through “offer.” The pack gives that whole sentence to A03 and starts C03 at “Keep the scope small…” This removes the mid-sentence cutaway start without repeating or dropping approved script words.
- The machine transcript is diagnostic. It reports 36 request-head and 32 request-tail mismatches across 64 windows. Short clips can hallucinate after silence: a 2.8-second L01 A02 tail falsely suggested the distant “first page” sentence. Every presenter boundary therefore needs an audible, frame-aligned confirmation before these candidate payloads can become provider inputs. If a native window truly starts or ends inside a sentence, revise the edit boundary or native-audio treatment and regenerate this pack. Do not silently synthesize a fragment or duplicate spoken words.

## Remaining gates

1. Listen to and mark the actual first and last words of all 64 native presenter windows. Resolve each discrepancy against the current source MP4 and VTT, then regenerate and rehash the exact texts. Confirm each cutaway fits its gap at the approved voice pace with transition room.
2. Confirm the connected subscription account, voice entitlement and purpose-specific rights, privacy review, current balance, live per-job and aggregate credit quote, and a technically enforced ceiling no higher than the approved aggregate cap. Keep auto-reload and overage off. Obtain one explicit scope-bound production authorization before submission.
3. On authorized production, submit at most one speech job per lesson, no retries. Bind request, output audio, word timestamps, debit receipt, and source hashes. Render and inspect the native composites for no double speech, sentence continuity, captions, pacing, and complete MP4 playback before any later upload or learner rebind decision.

No HeyGen call, generated audio, purchase, credential or billing change, upload, learner rebind, publication, merge, or release occurred in this pack.
