# iMeshh Trumpet 01 — local mechanical repair proof

**Status:** isolated motion source for Captain visual review. No recruitment page integration, timeline replacement, Human QA, merge, deployment, or browser-delivered 3D asset is authorized by this proof.

## Licensed source and scope

The locally supplied iMeshh Trumpet 01 Blender ZIP (Product ID 60084; SHA-256 `5d7d57de0da0cd1defe1c2b61c48bf9d66c73b0d698644bb0715ba75b92526fa`) is used only inside a temporary local Blender session. The [product listing](https://imeshh.com/assets/trumpet) permits commercial renders and animations; the [iMeshh FAQ](https://academy.imeshh.com/faq/) restricts redistribution of the model. The ZIP, extracted Blender/FBX/GLB/texture files, separated mesh islands, and any recoverable source representation are intentionally absent from this PR. Only new rig/render code and non-extractable rendered media are tracked.

The source includes an upright mesh and a laying duplicate. The duplicate is discarded locally. The upright mesh separates into 82 connected components. `scripts/render_imeshh_repaired_proof.py` maps those components from exact vertex-count and bounding-box signatures; the script fails if the archive hash, loose-part count, required source objects, or expected materials differ.

## Mechanical repair

| Control | Component IDs in this exact archive | Motion |
| --- | --- | --- |
| Piston 1 visible button/stem | 24 | 4 mm axial press and return |
| First valve slide | 6, 14, 29, 30, 34, 44, 49, 51, 58, 61, 65, 71 | 8 mm outward along negative source Y, then return |
| Piston 3 visible button/stem | 22 | 4 mm axial press and return |
| Third valve slide | 7, 9, 20, 21, 28, 31, 35, 36, 52, 62, 68, 69 | 8 mm outward along positive source Y, then return |

Both slide groups include their full crooks, paired source tubes, and source ring/hook and water-key details. Four newly authored open annular inner shanks move with the slide roots. Four fixed outer sleeves wrap the moving source tubes at the valve connection. The first-slide sleeves have a 6.9 mm inner radius around source tubes of at most 6.68 mm outer radius; the smaller third-slide sleeves have a 5.9 mm inner radius around source tubes of at most 5.7 mm outer radius. The new shanks' 4.4 mm outer radius fits within the smallest measured source bore of 4.6 mm. Minimum measured radial clearance is **0.2 mm**. At maximum travel, each new shank retains at least **36 mm** of axial overlap with its fixed sleeve, and each original moving source tube retains at least **14.8 mm** inside its fixed sleeve. The latter is the critical visible continuity check. These are local geometric proof dimensions, not an instrument-maker's tolerance certification or a verified internal acoustic path.

The rig uses object transforms only: no vertex deformation, shape key, mesh interpolation, or camera movement in the MP4. The six close-up images show start, midpoint, and return for each slide. The camera is locked throughout the four-second, 24 fps proof in an upright/diagonal composition with the mouthpiece above the bell. A fixed 10% crop makes the small movements easier to judge at normal playback size; it does not track or transform individual parts. Materials retain brass, chrome, rubber, and cork identity under a controlled local studio setup.

## Review order

1. `repaired-mechanical-proof.mp4`: piston 1, first slide, piston 3, third slide, each press/extension and return in one second.
2. `first-start.png`, `first-mid.png`, `first-end.png`: inspect both first-slide junctions, moving ring/saddle, and crook.
3. `third-start.png`, `third-mid.png`, `third-end.png`: inspect both third-slide junctions, moving hook, and crook.
4. Withhold motion-source approval if any seam opens, source tube clips through a sleeve, collar floats, button/cap moves together, lighting flickers, or the 8 mm motion does not read at normal size.

## Reproduce and validate

```bash
/opt/homebrew/bin/blender -b -noaudio --python scripts/render_imeshh_repaired_proof.py -- --asset-zip /path/to/Decorations_Instruments_Trumpet_01_Blender.zip --out docs/qa/trumpet-recruitment-visual-story/imeshh-repair
python3 scripts/qa/check-imeshh-trumpet-license.py --asset-zip /path/to/Decorations_Instruments_Trumpet_01_Blender.zip
ffprobe -v error -show_streams -show_format -of json docs/qa/trumpet-recruitment-visual-story/imeshh-repair/repaired-mechanical-proof.mp4
git diff --check
```

The renderer extracts the exact verified ZIP under a temporary directory, never saves or exports a mesh, and deletes temporary source and intermediate frames after rendering. The license checker rejects tracked recoverable asset filenames and extensions, PNG ancillary or trailing data, and MP4 streams other than the single expected H.264 video. The proof remains a Captain review candidate until its rendered motion passes visual inspection.

## Exact local validation receipt

- Blender 5.1.2 rendered all 96 frames from one process with the exact archive hash. The clean render logged 82 mapped source components, 8 mm slide travel, 4 mm piston travel, 36 mm minimum new-shank overlap, 14.8 mm minimum original-tube overlap, and 0.2 mm minimum radial clearance.
- The final MP4 uses the fixed crop in the render script. For this checkpoint the same crop was applied to the clean uncropped encode with FFmpeg after rendering; this is one additional video encode, so a later direct rerender need not have the same binary hash.
- `ffprobe` found one H.264 video stream, 960×600, 96 frames, 4.000 seconds. FFmpeg decoded the entire MP4 without errors. The source-exclusion checker passed across Git candidate paths and found only image chunks in the six PNG stills and one video stream in the MP4.
- `first-start.png` and `first-end.png` have identical SHA-256 hashes, as do `third-start.png` and `third-end.png`; each midpoint has a different hash. This supports return-to-rest, while visual review remains the authority for seam and motion quality.
- Final MP4 SHA-256: `159c49d2ddf23881305a292b74c042e687e6b8e7f7c81880d27d29533d7ec147`. No live workflow or customer-data smoke was run.
