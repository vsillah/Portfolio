# Recruitment review QA

UI commit: `5eb53722`. Exact production build on localhost: `http://localhost:3017/work/trumpet-trainer/recruitment?revision=5eb53722`. The server used local placeholder Supabase values and no service-role key. No customer or child data was used.

The eight PNGs are browser screenshots from that route at 1280 × 850 and 360 × 780. They show the overview, existing gameplay media, seven-slide carousel, 14-day plan, local copy confirmation, activation gate, and narrow-width layout. `build-walkthrough.sh` converts those captures into the playable H.264 MP4. This is a stitched screenshot walkthrough of the actual rendered UI, including the confirmed copy action; it does not simulate video playback or claim a live outreach action.

Validation: 21 focused tests passed, changed-file ESLint passed, `git diff --check` passed, copied social slides matched the source files with `cmp`, and the production build completed. The in-app browser showed no external `a`, `img`, `source`, or `script` URL on the review route. Document width stayed within the viewport at 360, 768, and 1280 CSS pixels. The MP4 probes as H.264, 1280 × 850, 24 fps, 22.5 seconds, 540 frames.

The campaign remains inactive. This QA artifact contains no recipients or private replies.
