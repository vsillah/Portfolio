# Accelerated Phase 2 editorial scripts

This package scripts the first four of 16 recorded lessons in the merged curriculum. It is ready for editorial review, not recording or rendering. The canonical EPUB is the authority for claims, chapter order, and book cases. The merged Phase 1 outline fixes lesson promises, runtime, and decision-file progression. The older course kit informs pacing and tactical diagrams; it does not establish live product or customer proof.

| Lesson | Target | Spoken words / rate | Exact book files | SAM source art | Learner decision-file page | State |
| --- | ---: | ---: | --- | --- | --- | --- |
| [L01](L01.md) | 09:00 | 1,088 / 120.9 wpm | Foreword `c002`, safety `c003`, Ch1 `c004` | Full infographic; Signals plate | Cover sheet and data boundary | Editorial review |
| [L02](L02.md) | 10:00 | 1,187 / 118.7 wpm | Ch2 `c005`, Ch3 `c006` | Signals plate | Priority choice and two alternatives | Editorial review |
| [L03](L03.md) | 09:00 | 1,051 / 116.8 wpm | Ch4 `c007` | None; book case and synthetic cards | Decision question and evidence-gap card | Editorial review |
| [L04](L04.md) | 10:00 | 1,207 / 120.7 wpm | Ch5 `c008`, Ch6 `c009` | None; synthetic persona cards | Living persona with source/review date | Editorial review |

Total: **38:00 and 4,533 spoken words**. Pause time for writing is additional. Scene-level rates are checked by `python3 docs/accelerated-course-modules/curriculum/scripts/validate.py` from the repo root. The validator reads the canonical EPUB through ZIP/XHTML `ElementTree`, checks exact cited heading text, scene order and rates, avatar boundaries, storyboard beats, privacy notes, and capture blocks. The [manifest](manifest.json) is machine-readable; the [storyboard brief](storyboard-brief.md) gives each scene a shot, art source, motion, transition, crop, and accessibility treatment.

## Source and privacy boundary

- Book cases are presented as book cases. No numerical result from the book is repeated as a verified current outcome. The fictional membership service is a synthetic exercise, never customer proof.
- Public Portfolio course or prototype UI is a possible future shot only after exact route/revision capture and privacy review. No current UI or internal/admin capture is in these boards.
- Use public, synthetic, or explicitly approved inputs. Do not put restricted company or customer information into external AI tools. Keep production provenance and synthetic-asset receipts outside audience-facing frames.
- Existing source art is `public/showcases/service-prototypes/accelerated-sam-infographic.png` and `public/showcases/service-prototypes/v2/sam-signals-plate.webp`. The Signals art carries navigation and chapter concepts; it is not an outcome diagram or proof of a live tool.

## Editorial decisions

1. **Runtime and faithful coverage:** The 9/10/9/10-minute outline remains intact. Spoken words are 115–145 per minute in every scene, including exercise handoff. Worksheet pause time sits outside recorded runtime. No conflict required a runtime change.
2. **Chapter 4 dashboard:** The book supplies a persuasive framing example, including numbers and a reported approval. This script teaches the three-way trade without repeating the figures or implying that a public Portfolio dashboard produced that result.
3. **Chapter 5 notification case:** Its outcome figures are omitted. A synthetic first-task prototype gives the same small-test lesson without an unsupported result claim.
4. **Chapter 6 synthetic personas:** The on-screen card leaves observed evidence blank until it exists. Simulation may propose questions, never become customer evidence.
5. **Visual density:** The infographic is shown whole only as a map, then its Signals panel is enlarged. Later lessons use readable book-derived cards. The Signals plate appears where its funnel supports the spoken choice, not as a decorative repeat.
6. **Humanizer pass:** Applied the requested voice corpus and humanizer guidance to narration and audience copy. Removed formulaic “here's the” openings, generic AI uplift, empty three-part slogans, and unnecessary antithesis. Kept first-person scene language, spoken transitions, source distinctions, and a grounded action at each close. A read-aloud editorial pass remains the next gate.

## Next gate

Editorial review should read the four scripts aloud, check pronunciation and emphasis, challenge the synthetic example's clarity, and approve or revise before any storyboard render, avatar, voice, video, capture, upload, publishing, or deployment. No provider call or media generation occurred in this phase.

## L05–L08 continuation

The next four lessons are [L05](L05.md), [L06](L06.md), [L07](L07.md), and [L08](L08.md). They extend the same decision file from feedback ledger through roadmap/PRD trace, two learning checkpoints, and the book's ten-component learning plan. The [L05–L08 manifest](manifest-l05-l08.json), [storyboard brief](storyboard-brief-l05-l08.md), and [source notes](source-notes-l05-l08.md) keep the continuation separate from the merged L01–L04 package. Recorded target is **43:00 and 5,131 spoken words**; learner worksheet pauses are additional.

Run `python3 docs/accelerated-course-modules/curriculum/scripts/validate_l05_l08.py` from the repo root. It checks the canonical EPUB chapter text, cited section headings, six continuous scenes per lesson, 115–145 spoken words per minute, avatar windows, source art, storyboard beats, and manifest totals. The existing L01–L04 validator remains unchanged and should also pass. These scripts are ready for editorial read-aloud review, not provider production.

The humanizer pass focused on spoken specificity: removed generic “here's the” transitions, broad AI promises, false certainty from synthetic notes, and symmetrical slogans. The running membership example stays explicitly hypothetical, while the book's Sam and “Just Make It Faster” cases remain attributed to their chapters. A human read-aloud and audience-copy pass remain required before media work.

## L09–L12 continuation

[L09](L09.md), [L10](L10.md), [L11](L11.md), and [L12](L12.md) carry the same decision file through the decision theater map, stakeholder-specific brief, signal-to-decision loop, and jobs/simulation validation cards. The [manifest](manifest-l09-l12.json), [source notes](source-notes-l09-l12.md), and [storyboard brief](storyboard-brief-l09-l12.md) keep this continuation separate from L01–L08. Recorded target is **41:00**; worksheet pause time is additional.

Run `python3 docs/accelerated-course-modules/curriculum/scripts/validate_l09_l12.py` from the repo root. It checks the exact canonical EPUB hash and cited section text, six continuous scenes per lesson, spoken rates, avatar windows, approved SAM assets, storyboard beats, and manifest totals. These scripts are for editorial review before any provider or media production.
