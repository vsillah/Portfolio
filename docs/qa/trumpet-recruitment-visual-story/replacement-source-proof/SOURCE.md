# Replacement trumpet source checkpoint

Status: Captain accepted the isolated mechanics proof at `a7af2bfc`; the same GLB-based motion is now integrated into the inactive recruitment timeline on draft PR #1215. This is pending Captain review and is **not** Human QA approval or production activation.

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

The source's main tuning loop is part of its continuous leadpipe mesh, so this proof uses the separately modeled first-valve branch for beat 2. No number marker, raster overlay, or substitute trumpet geometry is animated. The branch shank extension is a mechanical continuity adjustment to the imported source meshes. Prior procedural-trumpet media under `blender-motion/` remains failed Human QA evidence.

## Integrated recruitment timeline

`scripts/build-trumpet-timeline.sh /tmp/trumpet-replacement-production` invokes `scripts/render_trumpet_timeline.py`, imports the preserved GLB, saves the derived Blender scene, renders 168 transparent 960×540 frames at 24 fps, and encodes transparent VP9 WebM, animated WebP for Safari, an H.264 fallback, and the final static poster. The HTML keeps its ordered six-step timeline, native detail disclosures, and original carousel sizing. The visual step markers are UI only; they do not substitute for instrument movement. The poster is also the reduced-motion and playback-failure state.

The committed media hashes are:

| Artifact | SHA-256 |
| --- | --- |
| `trumpet-timeline-poster.png` | `bdd06dde6b0fd3ed947092616f09e9aa96ec533e9129f7ff6f99d3a2f1fd7a9a` |
| `trumpet-timeline.webm` | `53983ec8561911714166748f15c4506dee008a52ad5cdac7bba6dafa17744f8a` |
| `trumpet-timeline.webp` | `047b6e19891af1841343494464acb3f3bc677585d02d7f165e81a3690fa075d7` |
| `trumpet-timeline.mp4` | `03144187f929e508b536de093c346bc52bb8b5a375a5f63da5f22e3e336aa299` |
| `trumpet-timeline-source/trumpet-timeline.blend` | `d6245475792334f2067d3c85de97a58a75df99236c2e9f95fc173106c3595fac` |

The route is still internal, noindex, and recruitment inactive. The page sends no contacts, enables no provider, and performs no outreach. Browser QA and exact-build recording are documented in the integration packet adjacent to this source record.
