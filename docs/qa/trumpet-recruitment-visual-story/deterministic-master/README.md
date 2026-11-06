# Deterministic trumpet master — Phase 1 anatomy checkpoint

**Status:** isolated Captain visual review candidate. No timeline animation, page integration, Human QA, merge, production deployment, provider use, or customer data.

**Binding:** Portfolio PR #1215; branch `codex/trumpet-recruitment-visual-story`; correction baseline `25692fd0f63681e8babf74da273f0753ed83e666`. This correction is confined to the master source, render script, and this QA packet.

## Review order

1. `side_orthographic.png` — silhouette, full bell return, main tuning loop, three casings, first/third slide placement.
2. `front_orthographic.png` and `top_orthographic.png` — depth and bell opening.
3. `valve_block_closeup.png`, `first_slide_closeup.png`, `third_slide_closeup.png` — assembly and port continuity.
4. `neutral_turntable.mp4` — 4 seconds, 48 frames, camera-only neutral inspection. No mechanical part moves.
5. `upright_candidate.png` — mouthpiece high and bell low, a presentation orientation candidate only.
6. `ANATOMY-REVIEW.md` — labeled loop identification and the remaining visual defects.
7. `hierarchy-check.json` and the two Blender files — named control roots and editable source.

## Build and validation

```bash
/opt/homebrew/bin/blender -b -noaudio --python scripts/render_trumpet_master.py
/opt/homebrew/bin/blender -b design-files/trumpet-trainer/deterministic-master/trumpet-master.blend -noaudio --python scripts/validate_trumpet_master.py
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,nb_frames -of default=noprint_wrappers=1 docs/qa/trumpet-recruitment-visual-story/deterministic-master/neutral_turntable.mp4
git diff --check
```

The Blender 5.1.2 clean load and GLB round trip passed. The validator found 98 objects in the saved scene and 87 after GLB import, including five independently named moving roots (three pistons and two slides). The turntable is H.264, 960×600, 48 frames, 4.0 seconds. The `.blend` has no external image dependencies to pack. The original reference images are linked in `SOURCE.md`, not embedded.

SHA-256: `trumpet-master.blend` `e291fcd7e2368239e12dd84e4c5628a357fed05627deee55ea000e48c7cf97e5`; `trumpet-master-candidate.glb` `f1726de8426fd3d7a8313b20b67ef92703d0f75461acf6c51db898ca8ac06cf3`; `neutral_turntable.mp4` `0e7d37995c3bc0bed9db6d781947ef2a07a5f4af22d2124f96270d70100fc0ad`.

## Review limits

The bell and straight bore match published Yamaha anchors; the remaining dimensions are modeled estimates from public manufacturer imagery. The three loops are now separated in silhouette, and the first/third slide crooks and valve hardware are smaller. Internal piston port machining and acoustic path length are not certified. Some close-up junctions still read as simplified collars or stubs, and the finish remains conspicuously CG. This corrected procedural model is **not approved as a photographic motion master**. Further surface polish would not establish fabrication fidelity; a measured physical reference or a fuller anatomy rebuild is needed before motion approval. Captain visual review should decide whether to retain this as a planning/rigging study only.
