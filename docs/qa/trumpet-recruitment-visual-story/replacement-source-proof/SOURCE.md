# Replacement trumpet source checkpoint

Status: isolated anatomy and mechanics proof for Integration Captain review. This is **not** wired into the recruitment page, approved for Human QA, or production media.

## Origin

- Source page: https://www.innerscene.com/tools/library/3d-parts/trumpet-fb8c8f28
- Direct GLB: https://files.innerscene.com/library/trumpet-fb8c8f28/c594005b13ded79e4dd6/trumpet.glb
- Source-page license statement: public domain (CC0), usable and modifiable commercially without required credit.
- Downloaded and verified November 6, 2026. Original bytes are preserved at `design-files/trumpet-trainer/innerscene-trumpet.glb`.
- SHA-256: `e112e28aaf88558f44eb21e566148462dda9b8336c5d47f652a28d2c5ccd54e1`.

## Isolated Blender proof

`/opt/homebrew/bin/blender -b -noaudio --python scripts/render_trumpet_replacement_proof.py` recreates `replacement-proof.blend` and normal-size PNGs. Set `TRUMPET_RENDER_MOTION=1` to render 56 transparent frames at 8 fps, then composite those onto the navy section color with FFmpeg for `isolated-six-beats.mp4`. This proof uses the actual GLB meshes. It is 1280×720 and seven seconds; the stills show the maximum travel of each distinct part at normal viewing size.

- Beat 1: restrained whole-instrument settle.
- Beat 2: `Valve tuning branch 1` travels 30 mm outward on its Y tube axis and returns. Its two straight shanks are extended 40 mm *in the derived Blender mesh*, behind the valve block, so the moving U remains engaged. The original GLB bytes are untouched.
- Beat 3: `Finger button.001` and `Valve button stem.001` travel together 19 mm down into casing 2, with a subtle body response.
- Beat 4: separate `Valve tuning branch 3` travels 35 mm outward on its Y tube axis and returns, with the same derived shank-continuity adjustment.
- Beat 5: buttons and stems 1 and 3 depress together 18 mm; casing and caps remain fixed.
- Beat 6: restrained whole-instrument settle.

The source's main tuning loop is part of its continuous leadpipe mesh, so this proof uses the separately modeled first-valve branch for beat 2. No number marker, raster overlay, or substitute trumpet geometry is animated. The branch shank extension is a mechanical continuity adjustment to the imported source meshes. Captain should judge both slide engagement and visual legibility before page integration. Prior procedural-trumpet media under `blender-motion/` remains failed Human QA evidence.
