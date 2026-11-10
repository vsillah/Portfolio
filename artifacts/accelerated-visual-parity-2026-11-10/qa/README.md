# Accelerated visual parity browser review

Captured from the production build of commit `b559baaa` at
`http://localhost:3017/accelerated/learningplan?revision=b559baaa`, using a
synthetic empty-progress browser profile. No customer data or credentials were
used.

- Desktop MP4: 1280 × 800; mobile MP4: 390 × 844. Each sequences stable browser
  frames after the lesson selection and seek interactions. They show L01 at 03:00,
  L08 at 06:00, L11 at 04:00, L15 at 05:00, and L16 at 04:00, then the natural
  L16 end slide. Matching PNGs capture the pause states.
- Tablet PNGs: 820 × 1024; L08, L11, and L15 at the same timestamps.
- The mobile and tablet L08/L11/L15 diagrams keep their field labels above
  the native caption band. The 390px player reserves dark space below the
  16:9 image for captions and native controls. Fullscreen remains available
  through the native player control.
- The final lesson slide says **FINAL VIDEO FINISHED** when the video ends.
  The separately tracked lesson completion count remains **0 of 16** in this
  fresh profile; the slide does not claim course completion.

Capture: `node scripts/qa/record-accelerated-visual-parity.mjs
'http://localhost:3017/accelerated/learningplan?revision=b559baaa'`.
Transient browser seek loading frames are excluded from the review MP4s.
Both MP4s passed FFmpeg decode and `ffprobe` checks.
