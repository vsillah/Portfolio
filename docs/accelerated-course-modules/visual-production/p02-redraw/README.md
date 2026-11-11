# P02 SAM motif redraw: still-only review pass

Status: **local still gate passed; video and learner-media gates remain closed**. This is one source-bound redraw after the raster extraction failures recorded on draft PR #1270 through `9f1da8ac`. It uses the approved SAM infographic at `public/showcases/service-prototypes/accelerated-sam-infographic.png` (SHA-256 `13ef37fb39a228c79253538174cd9b3d77f6c7e630e9929dfa99e6cfa97f45c6`) and the tracked P02 base frame `artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/p02-clean-base.png` (SHA-256 `1bb646676d7b37efbac05b5afe9c9cfc8e0894107d01e7aa7600fb467076f682`). The base itself is a prior derived frame; the approved infographic is the visual authority.

| Section | Original SAM visual reference region (x1,y1,x2,y2 on 1136×944) | Redraw source | Meaning retained |
| --- | --- | --- | --- |
| Signals | `(160,590,285,744)` | `signals-target.svg` | A signal reaches a target. |
| Alignment | `(505,208,635,325)` | `alignment-trophy.svg` | A trophy represents outcomes. |
| Momentum | `(808,350,1032,581)` | `momentum-loop.svg` | Circular arrows represent a continuing cycle. |

The regions above are exact coordinate bounds used for visual reference, not pixels pasted into the redraw. Each vector is a clean, simplified reconstruction of the owned motif in the original navy and warm-gold palette. The only visible section words are the source headings `SIGNALS`, `ALIGNMENT`, and `MOMENTUM`; no new claim, neighbor label, or duplicate overlay was added. The full original map remains a separate context view.

The fixed presenter anchor is `(1136,348,672,384)` on 1920×1080. The heading occupies `(270,328)–(810,420)` and the vector motif `(365,410,350,350)`. The visible heading-plus-motif group centers at about source y520, 20px above the presenter centerline y540. The art's visible lower edge is about source y715, leaving about 65 source pixels before the simulated mobile control wash starts. These are geometric estimates; visual inspection of all eight stills was the acceptance check.

## Observed still gate

- Desktop 1280×820: Signals target/radio, Alignment trophy/star, and Momentum loop are each intact and centered beside the fixed presenter. All headings read. No motif touches the simulated control strip. The complete SAM map remains legible as an overview, though its small labels are not the focused teaching text.
- 390×844: all three heading words read, their motifs remain recognizable, and no art touches the simulated native controls. The complete map is context only; its micro-labels are too small to read at this width. The lower caption band is clear in this simulated layout, but final caption compositing was not tested.
- Source fidelity: compared the redraws against the full approved SAM plate. The target, trophy, and loop keep their original symbolic meanings without clipped source words or adjacent-art fragments. This does not approve replacing the original source art in learner media.

Local presenter-bearing stills are worktree-ignored, including these exact SHA-256 bindings:

| View | Desktop still | 390×844 still |
| --- | --- | --- |
| Full map | `p02-full-map-desktop-controls.png` `fb90520799addabab799efd549aa93c3cd325d33b8c0954baba073b99312b156` | `p02-full-map-390x844-controls.png` `d429126994c4008409867a17b099c96da306814b242719841ed4dd303c53235c` |
| Signals | `p02-signals-desktop-controls.png` `a8b29af8a9568c3ff4f8b1bdff81653913d285955a9bdb24433acc2de7ab0a4f` | `p02-signals-390x844-controls.png` `7a26f78f52f60df74411b5c7f3e07b132c4c70c3b4255a9cbda5b4768ad43973` |
| Alignment | `p02-alignment-desktop-controls.png` `a54704552d8975f4a5011ff124ac9d49f0b9a6089ce86fe246d79f3a84015d17` | `p02-alignment-390x844-controls.png` `3cf69935f0c79f84836c0052cc37b80f7c094e6285ca015153de78ba498cb839` |
| Momentum | `p02-momentum-desktop-controls.png` `267fdb46114915895585c43aaf2e1c215f759bc2a8acdc9af7ff66aaebe588f3` | `p02-momentum-390x844-controls.png` `a916f1bef9e51eb0325148bfaeae6fd6ab8972e30d8b3610330350bf3ceb31d5` |

All files above live under `artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/p02-redraw-stills/`; its local `receipt.json` also binds the source and vectors. Rebuild with `python3 -B scripts/qa/build-accelerated-p02-redraw-stills.py`. XML parsing, Python compilation, `git diff --check`, and two deterministic builds with eight identical output hashes passed.

No MP4 render, HeyGen call, credit spend, learner-media or J01 timing change, merge, or release occurred. Actual player controls, final captions, encoded frames, and audio require a separate authorized gate. This is not a Human QA handoff.
