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

### Illustration gate

Audit every timed scene against its approved narration and shot before treating a lesson visual as ready. A frame should show the situation, source artifact, decision, or change that the presenter is describing. Sparse labels in generic boxes, repeated stick-figure handoffs, empty worksheets, and abstract timelines need scene-specific evidence or a deliberate teaching reason to remain. Keep the approved SAM, Signals, Alignment, and Momentum art as the visual vocabulary; use each plate at the exact beat it supports rather than letting a short plate clear the surrounding scene. Give each scene a one-second read, a small visible-text budget, and a caption-safe mobile composition. Check the actual full-resolution frame and rendered player, not only a layout label or contact sheet.

For every speaking scene, inspect the opening, middle, and closing beats in the actual composite. Name the visual claim carried by each beat and the source artifact or case detail that makes it visible. A presenter beside a title, sparse list, or empty card is a production gap even when the narration and timing pass. An unchanged illustration may hold only when the same visible evidence remains the subject of the speech; record that reason. Recompose the art around the fixed presenter inset and the mobile caption band. Keep pacing-only review candidates separate from illustration-ready learner media until this scene-by-scene playback gate passes.

The source-bound [98-scene illustration audit](../../../artifacts/accelerated-illustration-audit-2026-11-11/README.md) records current visual proposal frames, approved shot specificity, source conflicts, and proposed treatments. It is review-only; its L02 specimen does not authorize a learner-media change.

### Lesson media voice and screen contract

Spoken teaching continues when the presenter is off screen. A silent learner-work hold is allowed only when the scene explicitly names the pause, gives a learner action, and records its start and end time. After compositing, reject any unmarked audio gap over two seconds. Preserve native presenter footage and audio in their exact windows; avoid overlapping narration or changing frame sync. Captions must match the final spoken mix and stay clear of instructional art and player controls.

Keep the presenter inset at one fixed on-screen anchor and size throughout a lesson whenever the presenter appears. Reserve that rectangle and recompose slide content around it; do not move the presenter to make room for text or art. Place the inset above native player controls and clear of the caption region; a bottom-right anchor that can be clipped or covered by controls is not acceptable. Presenter-free scenes may use the full canvas. Bind the anchor coordinates and control/caption clearance in each composite receipt, then compare rendered frames from every presenter window at desktop and mobile widths; a location or scale jump, clipping, or overlap fails visual QA. A review-only native sentence move must retain the source speaking pixels and audio while respecting this anchor.

Center the primary teaching art and text within the **available content region** after reserving the fixed presenter, caption band, and native-control guard. Clearing controls by pinning all teaching content to the top fails visual balance. Compare full-resolution desktop and narrow player frames with controls visible; record the art, presenter, and caption rectangles and whether the key teaching words remain readable. Agentified's finished L01 and L05 composites place a 768×432 presenter panel at source (1048,326) on 1920×1080; use that measured middle-right treatment as a visual reference, then validate any Accelerated adjustment against its native crop and the actual learner content.

Use one short on-screen teaching point per speaking beat. Add at most one supporting line when it adds meaning. Do not repeat source-art labels in overlays, or duplicate captions, player navigation, or production labels. Keep the presenter fixed at the approved middle-right anchor and center the art and teaching point in the remaining content area. Both must remain readable in the 390px player with captions and controls visible. Preserve approved narration and source art; record any overlay words removed. A sparse heading beside the presenter does not clear the illustration gate.

Finished Agentified L01 at 5s and L05 at 5s show a restrained point with brief context beside the presenter; L01 at 40s adds a distinct work artifact. L01 at 250s keeps a timed exercise to one number and instruction. These are hierarchy references, not a literal scene template: Agentified L05 at 100s and L08 at 90s are text-dense counterexamples to inspect, not copy. Accelerated L01 P01 still needs to show why the blank decision field matters during its spoken beat.

Keep the teaching frame focused on one idea. Remove scene codes, production/operator labels, repeated artifact names, decorative progress markers, and dense worksheet copy when they compete with the narration or captions. The learner player already supplies navigation and progress. Preserve approved book/SAM art, synthetic-example labels where they convey a real provenance boundary, and the data-use rule.

A system voice may be used for a local timing proof. A releasable composite requires an authorized narration source or voice decision, a final caption pass, presenter audio/frame checks, and rendered desktop/mobile review. The local L01 proof and the L01–L16 silence audit are in `artifacts/accelerated-lesson-pacing-2026-11-10` and `lesson-media-pacing-audit-2026-11-10.md`.

The packet gives a renderer exact scene timing and audio ownership, but it does not approve an avatar, a voice, a provider request, final artwork, release, or publication. A later production pass must build the synthetic cards, check every caption against the final mix, verify responsive and reduced-motion outputs, and audit all customer-facing text. Any real capture needs route, revision, capture date, rights, privacy/redaction approval, and a stable hash before it can enter a lesson.
