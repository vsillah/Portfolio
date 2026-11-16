# P02 vertical-center review

Status: **rejected at the optical-alignment gate**. Source commit `2ab998d4`; this earlier local reel was rendered on 2026-11-11 and preserved as `l01-p01-p02-middle-motion-before-optical-center.mp4`, SHA-256 `58d52c06d573702d42ec6da48e9ea756cfe94afff1cf4cff02238d23c07505dc`. Vambah found the focused source-art content still partly offset despite matching crop-center coordinates. The one bounded [optical revision also stopped](p02-optical-center-failure-receipt.md) when its encoded content remained top-heavy.

Vambah's correction was to place the SAM teaching art on the fixed presenter's vertical middle rather than near the top. On the 1920×1080 source canvas, the presenter remains `(1136,348,672,384)`, center y=540 (rendered 1280×720 center y=360). The full SAM map is `(275,320,530,440)`, center y=540. Each source-art focus crop is placed at `(240,335,600,409)`, center y=539.5 (rendered y=359.67), a measured 0.5 source-pixel optical offset. The small brand remains at the top. No duplicate overlay heading was added.

The full map ends at source y=760 and each focus ends at y=744; they retain 160 and 176 source pixels, respectively, to the prior y=920 control guard. The map's gold footer remains visible in the whole-map views. It is contextual and its small lettering is **not** claimed readable at 390px. The source-art Signals, Alignment, and Momentum headings remain readable in their focused views.

| Check | Result |
| --- | --- |
| Encode and decode | One render; 320 frames, 12.821333 seconds, full decode passed. |
| Audio identity | The single copied prior AAC track decodes to 2,482,176 bytes of 48 kHz stereo PCM, SHA-256 `b86a0394c94c793529d3b4c75ea8031975ddd328cac7de4962bcace963b76c97`, identical to the preserved prior reel. This retains its audio joins; no separate listening review is claimed. |
| Desktop Chrome | Alignment at 9.13s and full-map return at the end were inspected at 1280×720 video display with native controls visible. Art and presenter are middle-aligned and clear the controls. |
| 390×844 Chrome | Signals at 7.73s, Alignment at 9.13s, Momentum at 10.63s, and full-map return at 12.03s were inspected with native controls visible. Focus headings, map footer, and presenter remain visible and clear the controls. |
| Caption space | The art stays above the reserved lower band in the layout stills and above native controls in actual playback. This short reel has no caption track; a captioned learner composite must clear its own desktop/mobile gate. |

This historical reel is no longer the review candidate. Its focused crops made hard cuts through salient source-art content. No learner media or binding, J01/C01/C02 timing, HeyGen, spend, merge, or release action changed.
