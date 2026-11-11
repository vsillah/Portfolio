# Accelerated presenter audio listening index

**Status:** review-only. These clips use existing native source audio. The 16 canonical lessons, learner bindings, approved cutaway text, speech payloads, and source timings are unchanged. Listen to each before/after comparison with an audio-capable reviewer; the machine checks are not audible approval.

## One-pass review reel

[Play the 2:05 priority listening reel](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/accelerated-presenter-priority-listening-reel.mp4). Each chapter opens with the lesson/window, **ORIGINAL → CANDIDATE**, and the exact phrase to check. The reel embeds chapter markers. The [receipt](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/receipt.json) binds the six source hashes and confirms that their AAC packet payloads appear in order without re-encoding; only chapter-card silence was newly encoded. The [chapter contact sheet](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/chapter-contact-sheet.png) and [clip-entry contact sheet](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/source-contact-sheet.png) show the legibility and sequence checks. Full MP4 decode passed.

| Chapter start | Review segment | Individual clip |
| ---: | --- | --- |
| 00:00.00 | L05 A02→A03 · “Our six notes support a question, not a verdict.” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l05-sequence-before-after.mp4) |
| 00:26.68 | L06 A02→A03 · “Imagine the team tests the card and finds…” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l06-sequence-before-after.mp4) |
| 00:52.96 | L08 A02→A03 · “Before there is any data, walk the plan…” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l08-sequence-before-after.mp4) |
| 01:18.40 | L06 A01 · retain “cards” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/l06-a01-tail-pcm-before-after.mp4) |
| 01:33.50 | L16 A01 · retain “pain point” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/l16-a01-tail-pcm-before-after.mp4) |
| 01:49.90 | L16 A02 · retain “it” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/l16-a02-tail-pcm-before-after.mp4) |

## Priority 1: coordinated A02→A03 joins

Each clip plays the original A02 tail and A03 head, then the proposed A02 cut and A03 with the source-audio opening moved before it. C02 narration belongs between those presenter windows; its actual audio is not in the short comparison. See the [timing budget](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/timing-budget.json) before considering a full-lesson edit.

| Lesson | Before/after MP4 | Listen for | Measured opening moved |
| --- | --- | --- | ---: |
| L05 | [A02→A03 sentence](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l05-sequence-before-after.mp4) | “Our six notes support a question, not a verdict.” Check “views” at the cut and “question, not” at the join. | 2.42 s |
| L06 | [A02→A03 sentence](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l06-sequence-before-after.mp4) | “Imagine the team tests the card and finds…” Check “IDs” at the cut and “card and” at the join. | 2.28 s |
| L08 | [A02→A03 sentence](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l08-sequence-before-after.mp4) | “Before there is any data, walk the plan…” Check “exercise” at the cut and “data, walk” at the join. | 2.00 s |

Both ASR models found the approved sentence in each local joined A03 and omitted the moved opening from its revised A02. This does not prove the audible join or that the approved C02 narration fits with transitions. The [sequence receipts and full-MP4 ASR](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/manifest.json) bind source hashes and outputs.

## Priority 2: three sample-accurate PCM cuts

| Lesson | Before/after MP4 | Listen for |
| --- | --- | --- |
| L06 A01 | [“cards” cut](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/l06-a01-tail-pcm-before-after.mp4) | Final plural sound in “cards”; no partial “Now.” |
| L16 A01 | [“pain point” cut](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/l16-a01-tail-pcm-before-after.mp4) | Complete “pain point”; no partial “Write.” |
| L16 A02 | [“it” cut](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/l16-a02-tail-pcm-before-after.mp4) | Complete “it”; no partial “Put.” |

These three candidates re-encode their audio after a sample-accurate cut. The [PCM receipts and ASR](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/manifest.json) distinguish them from packet-copy candidates.

## Remaining queue

The [24 packet-copy before/after clips](presenter-jump-candidate-review-2026-11-10.md#per-lesson-listening-queue) remain queued for first/last-phoneme and sentence-order listening. Three of those—L05 A02, L06 A02, and L08 A02—are local cut inspections only; use the coordinated clips above to judge their A03 sentence joins. The separately approved L01 A02 isolated cut is recorded in its [own review](l01-a02-native-correction-review-2026-11-10.md).

No full-lesson edit, narration submission, provider call, purchase, upload, learner rebind, merge, or release is part of this listening index.
