# Accelerated illustration audit

Status: review only. This inspects all 98 timed L01–L16 visual proposal scenes and one cutaway frame per learner-bound native scene against the approved narration and shot descriptions. The native MP4s remain unchanged. [Open the scene gallery](review.html) from a local server; [scene data](scene-audit.json) carries exact hashes and treatments. A first [L02 illustration specimen](specimen-l02-01.html) tests the direction without changing learner media.

The visual-proposal contact-sheet pass found **54 text-first templates**, **41 repeated abstract diagrams**, and **3 approved-art or special scenes**. These are triage findings, not proof that every diagram is wrong. A source-art beat can occupy only part of its scene.

The learner-bound midpoint cutaway samples show the recurring beige split-screen, short-heading/list or direct-address treatment in **92 of 98 scenes** (L02–L16); L01 uses more distinct source art and work surfaces. [Contact sheets 1](native-contact-sheet-01.jpg), [2](native-contact-sheet-02.jpg), [3](native-contact-sheet-03.jpg), [4](native-contact-sheet-04.jpg), and [5](native-contact-sheet-05.jpg) show all 98 samples. This is a one-frame-per-scene finding, not a full-video timing or caption judgment.

Named approved-art beats appear in **10 scenes** for **347 seconds** of the 161-minute plan. Their presence does not clear the surrounding cutaway visuals.

L09–L16 have **48 title-only shot fields** in the source manifest. The gallery proposes scene-specific directions from their approved narration and labels them as proposals. L05-02 has a source-shot timing conflict: it lists F01–F06 there, while its narration places F05/F06 in Scene 3.

## Visual direction

Agentified is a useful comparison because its reviewed scenes keep a recognizable work surface while the decision changes. Accelerated should keep its own approved SAM, Signals, Alignment, and Momentum vocabulary: dark navy, teal, warm gold, source notes, decision files, and chapter art. Let the illustration show the situation, the evidence, and the change. Keep labels short and tied to a visible artifact.

| Lesson | Persistent illustration anchor |
| --- | --- |
| L01 | the open Q3 plan and the approved SAM map |
| L02 | a crowded planning board with fifteen competing priorities |
| L03 | a dashboard review table with a visible decision owner |
| L04 | a persona deck revised against observed behavior |
| L05 | six traceable feedback notes and a decision file |
| L06 | the first member task, its handoff, and a short product brief |
| L07 | a small test path with evidence at each checkpoint |
| L08 | a learning plan with measures tied to the first task |
| L09 | the quiet conversations behind a decision room |
| L10 | one proposal shown to two decision rooms |
| L11 | a failed test brought into a shorter review meeting |
| L12 | source feedback traced into a job and a validation question |
| L13 | a flat metric examined beside its possible causes |
| L14 | one proposal tested against cost, objection, and evidence |
| L15 | a local improvement carried into another team with context |
| L16 | the first decision revisited through the completed file |

## Production gate

First production wave: L01-01, L02-01, L03-01, L04-02, L05-01/02/04, L08-01, L09-01, L12-01/03, L13-01, and L15-01/04. These establish the physical work surfaces, correct the L05 source boundary, and protect book/fiction/simulation labels. The remaining text and title-only scenes follow before diagram enrichment. L16-06 stays in its separate end-screen lane.

Each scene needs a one-second visual read, source-accurate case detail, and a distinct change or reason to hold. Where a worksheet is the subject, show a meaningful field being filled instead of an empty template. Preserve the approved art at its natural ratio and identify the exact narration beat it supports. Audit full-resolution frames and native-caption playback at desktop and mobile widths; a contact sheet cannot establish legibility. L16-06 remains with the separate end-screen lane.

The L02 specimen is an original synthetic planning-board illustration generated with the built-in image tool, then edited once to show exactly fifteen notes. Its approved Signals-plate style reference and output hash are recorded in `scene-audit.json`. It is a visual direction test, not evidence of a real meeting or measured result.

No learner media, narration, captions, provider state, or bindings changed. The gallery is an internal review surface, not a finished lesson.

## Rebuild

```bash
python3 -B scripts/qa/audit-accelerated-illustrations.py build
python3 -B scripts/qa/audit-accelerated-illustrations.py check
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/artifacts/accelerated-illustration-audit-2026-11-11/review.html`.
