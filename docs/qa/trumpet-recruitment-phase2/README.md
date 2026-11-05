# Recruitment review QA

UI commit: `a80f3f2d000c57350f98f0ce4e019fca19b47a7b`. Exact production build on localhost: `http://localhost:3017/work/trumpet-trainer/recruitment?revision=a80f3f2d000c57350f98f0ce4e019fca19b47a7b`. The server used local placeholder Supabase values and no service-role key. No customer or child data was used.

The twelve PNGs are in-app browser screenshots from that route at 1280 × 850 and 360 × 780. They show the overview, existing gameplay media, seven-slide carousel, 14-day plan, local copy confirmation, activation gate, and narrow-width layout. The desktop and mobile educator frames show the corrected full-name signature, AmaduTown website and established tagline, with no phone number. `build-walkthrough.sh` converts those captures into `trumpet-recruitment-review-a80f3f2d.mp4`. This is a stitched screenshot walkthrough of the actual rendered UI, including confirmed local copy actions; it does not simulate video playback or claim a live outreach action.

Validation: 21 focused tests passed, changed-file ESLint passed, `git diff --check` passed, and the production build completed with an 8 GB Node heap. The in-app browser showed no external `a`, `img`, `source`, or `script` URL on the review route. Document width stayed within the viewport at 360, 768, and 1280 CSS pixels. The MP4 probes as H.264, 1280 × 850, 24 fps, 32.5 seconds, 780 frames; a full FFmpeg decode passed.

The campaign remains inactive. This QA artifact contains no recipients or private replies.
