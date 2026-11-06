# Procedural trumpet timeline source

This correction replaces the CSS valve-cap overlay in PR #1215 with one Blender 5.1 scene. The original generated portrait PNG remains in the repository as the visual reference and is not composited into the animation. The new instrument consists of modeled brass tubing, a spun bell, receiver collars, three separate valve plungers, and two distinct slide loops. No external model, texture, or audio was used.

Rebuild with `scripts/build-trumpet-timeline.sh /tmp/trumpet-render`. It runs `scripts/render_trumpet_timeline.py`, saves `trumpet-timeline-source/trumpet-timeline.blend`, renders 168 transparent PNG frames at 512×768 and 24 fps, and encodes transparent VP9 WebM, HEVC with alpha for Safari, and H.264 MP4 against the page's navy background as a final browser fallback. Safari chooses HEVC first because its VP9 playback painted the transparent region black in live QA. Frame 168 is the stable transparent PNG poster for reduced motion and playback failure. The source `.blend` and script are versioned with the shipped media.

Motion: frames 1–17 instrument settle; 26–48 upper/main slide moves along its tube axis and returns; 74–92 center valve press and damped whole-body response; 96–121 distinct lower/third-valve slide moves along its tube axis and returns; 122–145 outer valve combination; 145–168 bell rim light resolves. The HTML cards activate shortly after their corresponding modeled action begins. The native six-step list and details controls remain available throughout.

The earlier `motion-60b526d0` QA packet is historical evidence for the rejected CSS-overlay implementation and must not be used to approve this correction. The recruitment route remains internal, noindex, and inactive; no outreach or provider action was taken.
