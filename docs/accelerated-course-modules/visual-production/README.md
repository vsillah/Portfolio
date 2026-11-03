# Accelerated visual production packets

This is the scene-level review package for the approved L01–L16 narration at commit `932870eccabd393fa7401145b2e38db142891133`. It covers 98 scenes across 161 recorded minutes. The source scripts remain the narration authority; `manifest.json` copies their text exactly and records each script hash. The four `packet-*.md` files are generated human handoffs.

## Files

- `manifest.json`: canonical timed scene record, including shot, copy, captions, motion, avatar, audio, accessibility, and source lineage.
- `asset-register.json`: local path, hash, origin, and use boundary for the EPUB, SAM art, cover, and logo.
- `packet-l01-l04.md` through `packet-l13-l16.md`: complete scene instructions and exact narration for editors.
- `review.html`: local review page with four composition studies. The PNG files capture that page at desktop and 390 px mobile widths; the MP4 is a silent walkthrough of those exact local states.
- `build_packets.py` and `test_packets.py`: deterministic generation, drift checks, and mutation regressions.

The frame studies use approved plates as source art. Other scene cards remain specified instructional graphics with stable synthetic identities, pending production. They do not represent current customers, shipped tools, or measured results. No avatar, voice, provider media, final course video, upload, or external execution was produced.

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

The packet gives a renderer exact scene timing and audio ownership, but it does not approve an avatar, a voice, a provider request, final artwork, release, or publication. A later production pass must build the synthetic cards, check every caption against the final mix, verify responsive and reduced-motion outputs, and audit all customer-facing text. Any real capture needs route, revision, capture date, rights, privacy/redaction approval, and a stable hash before it can enter a lesson.
