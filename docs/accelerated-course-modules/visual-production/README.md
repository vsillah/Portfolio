# Accelerated visual production packets

This is the scene-level review package for the approved L01–L16 narration at commit `932870eccabd393fa7401145b2e38db142891133`. It covers 98 scenes across 161 recorded minutes. The source scripts remain the narration authority; `manifest.json` copies their text exactly and records each script hash. The four `packet-*.md` files are generated human handoffs.

## Files

- `manifest.json`: canonical timed scene record, including shot, copy, captions, motion, avatar, audio, accessibility, and source lineage.
- `asset-register.json`: local path, hash, origin, and use boundary for the EPUB, SAM art, cover, and logo.
- `packet-l01-l04.md` through `packet-l13-l16.md`: complete scene instructions and exact narration for editors.
- `review.html`: local review page with four composition studies. The PNG files capture that page at desktop and 390 px mobile widths; the MP4 is a silent walkthrough of those exact local states.
- `build_packets.py` and `test_packets.py`: deterministic generation, drift checks, and mutation regressions.

The frame studies use approved plates as source art. Other scene cards remain specified instructional graphics with stable synthetic identities, pending production. They do not represent current customers, shipped tools, or measured results. No avatar, voice, provider media, final course video, upload, or external execution was produced.

Human QA copy revision: the L08-03 fields, L11-03 loop, and L16-06 close are short action lists. The approved scripts still supply the exact narration and source binding. Representative frames keep the title larger than interior copy. The regression test rejects arrow chains and dot/slash-delimited shorthand in their visible copy.

## Rebuild and check

From the Portfolio root:

```bash
python3 docs/accelerated-course-modules/visual-production/build_packets.py build
python3 docs/accelerated-course-modules/visual-production/build_packets.py check
python3 -m unittest discover -s docs/accelerated-course-modules/visual-production -p 'test_*.py' -v
python3 docs/accelerated-course-modules/curriculum/validate.py
python3 docs/accelerated-course-modules/curriculum/scripts/validate.py
python3 docs/accelerated-course-modules/curriculum/scripts/validate_l05_l08.py
python3 docs/accelerated-course-modules/curriculum/scripts/validate_l09_l12.py
python3 docs/accelerated-course-modules/curriculum/scripts/validate_l13_l16.py
```

Open the review page from `python3 -m http.server 8765 --bind 127.0.0.1` at `/docs/accelerated-course-modules/visual-production/review.html?rev=932870eccabd393fa7401145b2e38db142891133`. `render_walkthrough.sh` rebuilds the MP4 from the recorded local screenshots and verifies its video stream with `ffprobe`.

## Production handoff boundary

### Lesson media voice and screen contract

Spoken teaching continues when the presenter is off screen. A silent learner-work hold is allowed only when the scene explicitly names the pause, gives a learner action, and records its start and end time. After compositing, detect and review every audio gap over 12 seconds. Preserve native presenter footage and audio in their exact windows; avoid overlapping narration or changing frame sync. Captions must match the final spoken mix and stay clear of instructional art and player controls.

Keep the teaching frame focused on one idea. Remove scene codes, production/operator labels, repeated artifact names, decorative progress markers, and dense worksheet copy when they compete with the narration or captions. The learner player already supplies navigation and progress. Preserve approved book/SAM art, synthetic-example labels where they convey a real provenance boundary, and the data-use rule.

A system voice may be used for a local timing proof. A releasable composite requires an authorized narration source or voice decision, a final caption pass, presenter audio/frame checks, and rendered desktop/mobile review. The local L01 proof and the L01–L16 silence audit are in `artifacts/accelerated-lesson-pacing-2026-11-10` and `lesson-media-pacing-audit-2026-11-10.md`.

The packet gives a renderer exact scene timing and audio ownership, but it does not approve an avatar, a voice, a provider request, final artwork, release, or publication. A later production pass must build the synthetic cards, check every caption against the final mix, verify responsive and reduced-motion outputs, and audit all customer-facing text. Any real capture needs route, revision, capture date, rights, privacy/redaction approval, and a stable hash before it can enter a lesson.
