# P01→P02 redraw motion review

Status: **one local motion reel passed technical and rendered-browser review; not learner media or Human QA-ready**. Source head before this pass: `dbcf1933` on draft PR #1270. The one authorized render is `artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/p02-redraw-motion/l01-p01-p02-redraw-motion.mp4`, SHA-256 `47f7101f8722393e9ca711fb274ff730b27af94e05f0274a0e779abc33a7f77e`. The voice-bearing MP4 and presenter-bearing boundary sheets are local and Git-ignored.

The reel runs P01 blank decision field → complete SAM map → Signals target → Alignment trophy → Momentum loop → complete map. The source-bound vector motifs and map remain the ones approved for still review in this directory. The fixed presenter anchor is `(1136,348,672,384)` on the 1920×1080 source canvas. The teaching content is centered beside it and stays clear of native controls in the reviewed frames.

## Checks

| Gate | Observation |
| --- | --- |
| Source and visuals | The approved still receipt, SAM asset SHA, vector SHA values, P01 base, source video, and donor audio were checked before rendering. New 1920×1080 focus backgrounds matched the approved desktop stills pixel-for-pixel across the teaching region. The full map remains context; each focus shows one intact, claim-consistent motif and readable heading. |
| Frame and duration | One H.264 video stream, one copied AAC audio stream; 1280×720 at 25 fps; 320 decoded frames; 12.821333s container duration; full FFmpeg decode passed. |
| Audio | The entire AAC track was copied once from `l01-p01-p02-middle-motion-failed-copy-reduction.mp4` (SHA-256 `820c42a81311152c454318d47549ca5ed90c8e44dfb8713d6aa5007b5d382461`). New and donor audio decode to the same 2,482,176 bytes of 48 kHz stereo PCM, SHA-256 `b86a0394c94c793529d3b4c75ea8031975ddd328cac7de4962bcace963b76c97`. No new speech cut was introduced by the visual handoffs. |
| Source speech joins | The existing 4.4s and 6.8s joins had nonzero 100 ms RMS on both sides: 28.71/32.97 and 52.25/28.74, respectively. Silence detection at −45 dB found no gap over 1.0s. These technical checks and PCM identity preserve prior joins; no separate human auditory listening claim is made. |
| Frame handoffs | Decoded pairs at 4.36/4.44, 6.76/6.80/6.84/6.88, 7.36/7.44, 8.84/8.92, 10.32/10.40, and 11.80/11.88s show the same presenter rectangle. The 6.84s source-entry frame is not blank. Hard cuts change only the teaching art. |
| Chrome desktop | On the exact localhost reel at 1728×962, P01, map, Signals, Alignment, and Momentum played and paused at their expected beats. Headings and motifs were clear, presenter remained middle-right, and native controls did not cover the art. |
| Chrome mobile | At 390×844, the same P01, map, three focus views, and map return were inspected with native controls visible. Focus headings and motifs remained readable; presenter and teaching art cleared the controls. The complete map's small labels are context only at this width. |

The exact Chrome route used was `http://127.0.0.1:8766/artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/p02-redraw-motion/l01-p01-p02-redraw-motion.mp4?rev=dbcf1933`. The local `motion-receipt.json` binds source/background/reel hashes and frame/audio checks. The local `p01-p02-boundary-pairs.png` and `focus-boundary-pairs.png` show decoded handoffs.

## Limits

This short reel has no final captions. The reviewed layout leaves reserved lower space, but caption placement and actual learner-player behavior are unverified. Native controls were checked in Chrome's direct MP4 player, not the Portfolio learner route. No HeyGen call, credit spend, learner-media or J01 timing change, merge, or release occurred. The next gate is captain review of this local reel and a separate final-caption/learner-player pass before Human QA.
