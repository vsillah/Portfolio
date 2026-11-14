# Accelerated presenter audio listening index

**Status:** review-only; Vambah has audibly approved the six priority comparisons and 24 packet-copy local cuts at their exact reviewed commits. These clips use existing native source audio. The 16 canonical lessons, learner bindings, approved cutaway text, and speech payloads are unchanged. Local-cut approval does not sign off full presenter windows, full lessons, or final voice timing.

## One-pass review reel

[Play the 2:05 priority listening reel](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/accelerated-presenter-priority-listening-reel.mp4). Each chapter card opens with the lesson/window, **ORIGINAL → CANDIDATE**, and the exact phrase to check. The start times below replace MP4 chapter metadata so the file has only browser-compatible video and audio tracks. The [receipt](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/receipt.json) binds the six source hashes and confirms that their AAC packet payloads appear in order without re-encoding; only chapter-card silence was newly encoded. Video was re-encoded as one constant-25-fps H.264 High Profile 4.1/yuv420p stream with faststart. The [chapter contact sheet](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/chapter-contact-sheet.png) and [clip-entry contact sheet](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/source-contact-sheet.png) show the legibility and sequence checks. Full MP4 decode passed. A localhost Chrome playback probe reached 7.22 s with `readyState=4`, no media error, and the expected 125.10 s duration; the integrated in-app Browser was unavailable in this lane, so its playback remains for captain confirmation.

| Chapter start | Review segment | Individual clip |
| ---: | --- | --- |
| 00:00.00 | L05 A02→A03 · “Our six notes support a question, not a verdict.” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l05-sequence-before-after.mp4) |
| 00:26.68 | L06 A02→A03 · “Imagine the team tests the card and finds…” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l06-sequence-before-after.mp4) |
| 00:52.96 | L08 A02→A03 · “Before there is any data, walk the plan…” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l08-sequence-before-after.mp4) |
| 01:18.40 | L06 A01 · retain “cards” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/l06-a01-tail-pcm-before-after.mp4) |
| 01:33.50 | L16 A01 · retain “pain point” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/l16-a01-tail-pcm-before-after.mp4) |
| 01:49.90 | L16 A02 · retain “it” | [Open clip](../../artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates/l16-a02-tail-pcm-before-after.mp4) |

The [human listening receipt](../../artifacts/accelerated-visual-parity-2026-11-10/priority-listening-reel/human-listening-receipt-2026-11-11.json) records Vambah’s approval of these six local comparisons at PR #1270 commit `9aaf109874a9ef4f302233aeb07914a88af4493e`: retained words and joins sounded clean, with no clipped, repeated, or missing speech. This signoff covers only those six clips. The 24 packet-copy cuts have a separate later receipt; neither approval establishes full-lesson timing.

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

## 24 packet-copy local cuts: three listening reels

Vambah approved these 24 local cuts after listening to all three reels at PR #1270 commit `31b05313e98376da9b2a29d2e12d7cc8983b22cc`: retained words intact, overlaps removed, and no clipped, repeated, or missing speech. The [scoped human listening receipt](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/human-listening-receipt-2026-11-11.json) binds each clip hash and chapter. This approval does not sign off full presenter windows or full lessons. Each card gives the exact lesson/window, cut direction, retained phrase, and phrase to omit; the clip then plays **ORIGINAL → CANDIDATE**. Chapter starts below are seek times in the reel, followed by the individual source clip and its hash-bound receipt. All three reels preserve the existing comparison clips’ AAC packet payloads in order. Chapter-card silence was newly AAC-encoded, and video was re-encoded to browser-compatible H.264 High Profile 4.1/yuv420p, constant 25 fps, with faststart. Full MP4 decode, two-stream probe, dual-model ASR, approved-script order, and audio-packet sequence checks passed. The [master manifest](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/manifest.json) binds every reel and source receipt.

The three **alternate** packet cuts—L05 A02, L06 A02, and L08 A02—use a different split from the approved coordinated A02→A03 joins above. Their signoff is local-cut only; the coordinated joins govern sentence continuity.

### Reel 1 · 2:03.18

[Play reel 1](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/packet-copy-listening-reel-01.mp4) · [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/reel-01-receipt.json) · [Chapter cards](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/reel-01-chapter-contact-sheet.png) · [Clip entries](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/reel-01-source-contact-sheet.png)

| Start | Cut | Listen for | Individual clip / receipt |
| ---: | --- | --- | --- |
| 00:00.00 | L02 A01 tail | Keep “the room is stuck”; omit “gives us a way” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l02-a01-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l02-a01-tail-receipt.json) |
| 00:16.40 | L02 A02 tail | Keep “offers a market frame”; omit “there is another question” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l02-a02-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l02-a02-tail-receipt.json) |
| 00:32.80 | L02 A03 tail | Keep “product question is clear”; omit “is it something you” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l02-a03-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l02-a03-tail-receipt.json) |
| 00:48.38 | L04 A02 tail | Keep “in a particular moment”; omit “a living persona needs” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l04-a02-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l04-a02-tail-receipt.json) |
| 01:04.78 | L04 A03 tail | Keep “and a review date”; omit “that is a real” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l04-a03-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l04-a03-tail-receipt.json) |
| 01:21.18 | L05 A01 tail | Keep “you what to change”; omit “the book has a” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l05-a01-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l05-a01-tail-receipt.json) |
| 01:35.47 | L05 A02 tail · **alternate** | Keep “easier movement between views”; omit “our six notes support” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l05-a02-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l05-a02-tail-receipt.json) |
| 01:49.11 | L06 A02 tail · **alternate** | Keep “link the ledger ids”; omit “imagine the team tests” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l06-a02-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l06-a02-tail-receipt.json) |

### Reel 2 · 1:57.60

[Play reel 2](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/packet-copy-listening-reel-02.mp4) · [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/reel-02-receipt.json) · [Chapter cards](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/reel-02-chapter-contact-sheet.png) · [Clip entries](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/reel-02-source-contact-sheet.png)

| Start | Cut | Listen for | Individual clip / receipt |
| ---: | --- | --- | --- |
| 00:00.00 | L08 A01 tail | Keep “belongs to the decision”; omit “gives the learning plan” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l08-a01-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l08-a01-tail-receipt.json) |
| 00:16.40 | L08 A02 tail · **alternate** | Keep “from this small exercise”; omit “before there is any” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l08-a02-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l08-a02-tail-receipt.json) |
| 00:29.59 | L09 A03 head | Keep “the book calls the”; omit “skeptic asks hard questions” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l09-a03-head-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l09-a03-head-receipt.json) |
| 00:43.03 | L09 A04 head | Keep “a map is not”; omit “would make it unsafe” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l09-a04-head-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l09-a04-head-receipt.json) |
| 00:58.63 | L10 A01 tail | Keep “that kind of meeting”; omit “uses a notification settings” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l10-a01-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l10-a01-tail-receipt.json) |
| 01:14.68 | L10 A03 head | Keep “says we cannot spare”; omit “members understand and begin” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l10-a03-head-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l10-a03-head-receipt.json) |
| 01:30.60 | L10 A04 head | Keep “we will bring the”; omit “and redesign the test” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l10-a04-head-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l10-a04-head-receipt.json) |
| 01:43.48 | L11 A03 head | Keep “imagine joining this work”; omit “action starts the service” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l11-a03-head-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l11-a03-head-receipt.json) |

### Reel 3 · 2:02.05

[Play reel 3](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/packet-copy-listening-reel-03.mp4) · [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/reel-03-receipt.json) · [Chapter cards](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/reel-03-chapter-contact-sheet.png) · [Clip entries](../../artifacts/accelerated-visual-parity-2026-11-10/packet-copy-listening-reels/reel-03-source-contact-sheet.png)

| Start | Cut | Listen for | Individual clip / receipt |
| ---: | --- | --- | --- |
| 00:00.00 | L11 A04 head | Keep “the learning system loop”; omit “and the next owner” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l11-a04-head-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l11-a04-head-receipt.json) |
| 00:13.84 | L12 A03 head | Keep “the simulation points to”; omit “separate from observed research” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l12-a03-head-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l12-a03-head-receipt.json) |
| 00:27.52 | L12 A04 head | Keep “the structure helps you”; omit “record the observed hesitation” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l12-a04-head-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l12-a04-head-receipt.json) |
| 00:41.84 | L13 A01 tail | Keep “result for this exercise”; omit “the fourth stratquest session” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l13-a01-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l13-a01-tail-receipt.json) |
| 00:58.24 | L13 A02 tail | Keep “help new members begin”; omit “the book's collaboration example” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l13-a02-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l13-a02-tail-receipt.json) |
| 01:14.64 | L14 A04 head | Keep “we have created an”; omit “the evidence cannot carry” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l14-a04-head-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l14-a04-head-receipt.json) |
| 01:31.04 | L15 A01 tail | Keep “between those two moments”; omit “names five scaling mistakes” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l15-a01-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l15-a01-tail-receipt.json) |
| 01:47.11 | L15 A03 tail | Keep “to defer say why”; omit “end with a decision” | [Clip](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l15-a03-tail-before-after.mp4) / [Receipt](../../artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates/l15-a03-tail-receipt.json) |

The separately approved L01 A02 isolated cut remains in its [own review](l01-a02-native-correction-review-2026-11-10.md). The [full-lesson timing decision list](full-lesson-timing-decision-list-2026-11-11.md) is the next review-only planning artifact; final voice fit and caption synchronization remain unresolved.

No full-lesson edit, narration submission, provider call, purchase, upload, learner rebind, merge, or release is part of this listening index.
