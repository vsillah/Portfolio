# L07-01 mobile presenter-safe source study

Status: **review-only, unbound**. This study begins at PR #1290 stop head `bd8115d631f3882d12228ba954acecfc840569eb`. It changes only the L07-01 mobile teaching field during the source's 0–9.37-second presenter interval. The four team roles, linked handoff folders, and complete three-box checklist now occupy the left teaching field. The fixed presenter rectangle occupies an empty right field. At 9.37 seconds the source's full L07 art resumes.

`teaching-field.png` is an original project-local derivative of `agentified/workshop/phase-3b-review/text-panel-padding/frames/illustrated/L07-01.png`. Its semantic objects and exact headline were checked against the source. `build.mjs` overlays the source's native 788×452 presenter crop at its unchanged `(1038,316)` position and copies the source audio and embedded subtitle streams. The field behind the crop uses the sampled RGB `(11,40,56)` from the source's native blank opening frame. This makes the protected blank frame read as reserved studio space without altering its pixels or timing. The native background and thin presenter outline remain in the source crop.

Build from the Portfolio root:

```bash
node agentified/workshop/phase-3b-review/text-panel-padding/l07-01-mobile-source-composition/build.mjs
```

The full candidate is `L07-mobile-source-candidate.mp4`. `L07-desktop-source-review.mp4` and `L07-mobile-composition-review.mp4` are 12-second privacy-safe **media** review clips at 1280×720 and 390×844. They are not browser screen recordings; browser route checks are recorded in `validation-receipt.json`. The mobile clip keeps the 16:9 lesson media within the 390×844 viewport for visual inspection. The desktop clip uses the original mapped source. All three MP4s decode.

The candidate was temporarily bound only in a disposable checkout of player head `7bb6267c9fb98172679e161aafa208dfc7a276c3` for local learner-route checks, then the binding was restored. The Portfolio product binding, player code, desktop media, VTT, learner data, completion, and replay code were not changed in this lane. The 57 focused player/workshop tests passed. Product binding and the full Phase 3B scene matrix remain integration work; this packet is not a release or Human-QA approval.

## Unified desktop and mobile continuation

PR #1290 stopped again at `a99eb906d15a1f9d24932b38b740620f672b05dd`: the unchanged desktop opening put the presenter over the four roles and checklist at 1280×844. `L07-unified-source-candidate.mp4` corrects that opening on **both** desktop and mobile. The earlier mobile candidate stays in this folder as the approved baseline. Its four roles, three handoff folders, headline, and three-box checklist remain on the left in the unified candidate. The presenter crop stays at source rectangle `(1038,316,788,452)` for 0–9.37 seconds, with the recorded background, outline, timing, and aspect ratio intact. The full source plate returns at 9.37 seconds.

`unified-teaching-field.png` is the original generated teaching field. `build-unified-field.sh` blends its empty right side to the native frame-zero studio color and writes `unified-studio-field.png`. The transition starts beyond the last illustration object; it has no hard panel edge. The script also writes desktop and 390-pixel presenter-safe-zone stills **before** motion rendering. The gold outline in those stills marks the protected rectangle; it is a QA overlay only. No teaching subject, connector, headline, or checklist enters it.

From the Portfolio root:

```bash
bash agentified/workshop/phase-3b-review/text-panel-padding/l07-01-mobile-source-composition/build-unified-field.sh
node agentified/workshop/phase-3b-review/text-panel-padding/l07-01-mobile-source-composition/build.mjs --unified
```

The full candidate is 251.332 seconds at 1920×1080/25 fps. Source and candidate audio and embedded subtitle stream hashes match exactly. `L07-unified-desktop-media-review.mp4` and `L07-unified-mobile-media-review.mp4` are decoded 12-second **media** clips at 1280×720 and 390×844; they are not learner-route recordings. `unified-validation-receipt.json` records the route check on player head `7bb6267c9` at desktop 1280×844 and mobile 390×844, including frame zero, presenter, post-window art, captions, and Aa states. The route binding existed only in a disposable checkout and was restored after review. No product binding or learner data changed here. Phase 3B must rerun the full L07–L16 matrix before any Human QA or integration decision.
