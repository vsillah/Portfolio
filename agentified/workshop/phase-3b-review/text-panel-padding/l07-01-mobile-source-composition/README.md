# L07-01 mobile presenter-safe source study

Status: **review-only, unbound**. This study begins at PR #1290 stop head `bd8115d631f3882d12228ba954acecfc840569eb`. It changes only the L07-01 mobile teaching field during the source's 0–9.37-second presenter interval. The four team roles, linked handoff folders, and complete three-box checklist now occupy the left teaching field. The fixed presenter rectangle occupies an empty right field. At 9.37 seconds the source's full L07 art resumes.

`teaching-field.png` is an original project-local derivative of `agentified/workshop/phase-3b-review/text-panel-padding/frames/illustrated/L07-01.png`. Its semantic objects and exact headline were checked against the source. `build.mjs` overlays the source's native 788×452 presenter crop at its unchanged `(1038,316)` position and copies the source audio and embedded subtitle streams. The field behind the crop uses the sampled RGB `(11,40,56)` from the source's native blank opening frame. This makes the protected blank frame read as reserved studio space without altering its pixels or timing. The native background and thin presenter outline remain in the source crop.

Build from the Portfolio root:

```bash
node agentified/workshop/phase-3b-review/text-panel-padding/l07-01-mobile-source-composition/build.mjs
```

The full candidate is `L07-mobile-source-candidate.mp4`. `L07-desktop-source-review.mp4` and `L07-mobile-composition-review.mp4` are 12-second privacy-safe **media** review clips at 1280×720 and 390×844. They are not browser screen recordings; browser route checks are recorded in `validation-receipt.json`. The mobile clip keeps the 16:9 lesson media within the 390×844 viewport for visual inspection. The desktop clip uses the original mapped source. All three MP4s decode.

The candidate was temporarily bound only in a disposable checkout of player head `7bb6267c9fb98172679e161aafa208dfc7a276c3` for local learner-route checks, then the binding was restored. The Portfolio product binding, player code, desktop media, VTT, learner data, completion, and replay code were not changed in this lane. The 57 focused player/workshop tests passed. A mobile-specific product binding and a full Phase 3B scene matrix remain integration work; this packet is not a release or Human-QA approval.
