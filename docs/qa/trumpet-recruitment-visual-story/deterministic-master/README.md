# Deterministic trumpet master — Phase 1 anatomy checkpoint

**Status:** isolated Captain visual review candidate. No timeline animation, page integration, Human QA, merge, production deployment, provider use, or customer data.

**Binding:** Portfolio PR #1215; branch `codex/trumpet-recruitment-visual-story`; baseline `2e3cc270da71c6ee75d223821e2aa3cc75277d9d`. All new files are confined to the master source, render script, validator, and this QA packet.

## Review order

1. `side_orthographic.png` — silhouette, full bell return, main tuning loop, three casings, first/third slide placement.
2. `front_orthographic.png` and `top_orthographic.png` — depth and bell opening.
3. `valve_block_closeup.png`, `first_slide_closeup.png`, `third_slide_closeup.png` — assembly and port continuity.
4. `neutral_turntable.mp4` — 4 seconds, 48 frames, camera-only neutral inspection. No mechanical part moves.
5. `upright_candidate.png` — mouthpiece high and bell low, a presentation orientation candidate only.
6. `hierarchy-check.json` and the two Blender files — named control roots and editable source.

## Build and validation

```bash
/opt/homebrew/bin/blender -b -noaudio --python scripts/render_trumpet_master.py
/opt/homebrew/bin/blender -b design-files/trumpet-trainer/deterministic-master/trumpet-master.blend -noaudio --python scripts/validate_trumpet_master.py
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,nb_frames -of default=noprint_wrappers=1 docs/qa/trumpet-recruitment-visual-story/deterministic-master/neutral_turntable.mp4
git diff --check
```

The Blender 5.1.2 clean load and GLB round trip passed. The validator found 94 objects in the saved scene and 83 after GLB import, including five independently named moving roots (three pistons and two slides). The turntable is H.264, 960×600, 48 frames, 4.0 seconds. The `.blend` has no external image dependencies to pack. The original reference images are linked in `SOURCE.md`, not embedded.

SHA-256: `trumpet-master.blend` `985a7abd455a663a54f47d0bb264502ecd8d5e659236afb6b6a821100a16c792`; `trumpet-master-candidate.glb` `a02c2df9553dbbe26ea7eaec525ba8c8771d17d8f2df1d24eae2cbfa98f590bd`; `neutral_turntable.mp4` `9890c1cae0d4f53625d9fbaaacb73fb5b4e511e39303e8faa71eca470f6b39b5`.

## Review limits

The bell and straight bore match published Yamaha anchors; the remaining dimensions are modeled estimates from a public parts diagram. Internal piston port machining and acoustic path length are not certified. The metal finish is a neutral inspection render, not yet the requested photographed final appearance. The Captain should withhold motion approval if any slide looks unattached, any brace floats, the first/third slide identity is unclear, or the upright orientation still reads as contrived. A player or instrument-maker reference remains the next useful anatomy check.
