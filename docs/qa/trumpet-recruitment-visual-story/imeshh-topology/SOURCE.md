# iMeshh Trumpet 01 topology gate — blocked

**Status:** local topology inspection failed the mechanical continuity gate. These two images are static diagnostic renders, not approved animation frames or page media. No iMeshh ZIP, mesh, Blender scene, texture, GLB, FBX, or source thumbnail is in this packet.

## Source and rights

- Source: iMeshh Trumpet 01, Product ID 60084, [public product listing](https://imeshh.com/assets/trumpet). Local archive: `Decorations_Instruments_Trumpet_01_Blender.zip`; SHA-256 `5d7d57de0da0cd1defe1c2b61c48bf9d66c73b0d698644bb0715ba75b92526fa`.
- The [product listing](https://imeshh.com/assets/trumpet) permits commercial renders and animations. The [iMeshh FAQ](https://academy.imeshh.com/faq/) prohibits sharing the extractable model. The licensed source remains local and is intentionally absent from Git, PR attachments, deployment, and browser-delivered 3D formats.
- `scripts/qa/check-imeshh-trumpet-license.py` requires the caller's local ZIP and its exact SHA-256, rejects known source filenames and restricted source extensions among Git candidate paths, and checks that the PNG stills have only image data chunks.

## Topology mapping

The native archive contains one main trumpet mesh and a laying duplicate. The duplicate was discarded locally. The main mesh separated into 82 connected components. The component IDs below are descending vertex-count order from this exact archive, **not stable semantic names supplied by iMeshh**.

| Assembly candidate | Connected components | Inspection result |
| --- | --- | --- |
| Three piston buttons and stems | 22, 23, 24 | Separately movable on the visible vertical axis; fixed top caps stay in place. Internal piston bodies were not established. |
| First slide, left side of side-view render | 6, 14, 29, 30, 34, 44, 49, 51, 58, 61, 65, 71 | Crook and paired visible tubes can move as a group with ring, mount, and water-key details, but displacement opens the valve connection. |
| Third slide, right side of side-view render | 7, 9, 20, 21, 28, 31, 35, 36, 52, 62, 68, 69 | Crook and paired visible tubes can move as a group with hook/key details, but displacement opens the valve connection. |

The [rest diagnostic](rest-diagnostic.png) colors the first-slide candidate orange and third-slide candidate blue against gray fixed geometry. The [12 mm displacement diagnostic](12mm-displacement-diagnostic.png) moves those candidates outward on their long axis. Both valve-side joints visibly separate. The same separation begins at 4 mm in local inspection. The source does not supply a separately identifiable telescoping inner shank that closes this gap. Component grouping alone cannot make a truthful clean slide extension. The component groups remain candidates because this failed gate does not justify certifying every piece of decorative hardware.

**Decision:** Stop before a motion MP4, timeline integration, or page change. A physical-model repair or a different licensed animation-ready asset is needed; no hidden shank or connection was fabricated for this checkpoint. The diagnostic stills use flat inspection shading, not the proposed final lighting.

## Validation

```bash
python3 scripts/qa/check-imeshh-trumpet-license.py --asset-zip /path/to/Decorations_Instruments_Trumpet_01_Blender.zip
git diff --check
```

The local extraction and all loose-part renders were made under `/tmp`; they are not required to review these diagnostic images and must not be uploaded or committed.
