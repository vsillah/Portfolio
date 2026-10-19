# KickLab typography review evidence

This packet reviews commit `3c2c1d72` at:

`http://127.0.0.1:3210/admin/social-content?campaignQa=campaign-package-preparation-v1&rev=3c2c1d72`

The route uses a synthetic local fixture. The evidence demonstrates the raster as a review direction, keeps typography performance **Unscored**, shows the expanded public research audit and exact candidate records, and leaves all visual plans blocked (0 prepared / 12 blocked). It does not approve the font treatment or establish that it performs well. The read-only search covered nine channels across sports science, physics education, youth STEM, and gameplay learning, with eleven exact candidate records. No example met the exact short-uppercase neutral-sans treatment (0/4 matched); five current Khan Academy AP Physics uploads form an eligible same-channel baseline with a median of 53,950 age-normalized 30-day-equivalent views. That baseline is recorded for context only because no matched-style cohort exists, so normalization remains null and the receipt remains Unscored. The original How Ridiculous exclusions remain preserved.

## Evidence

- `social-campaign-typography-review.mp4` — 7.32-second H.264 walkthrough, 1440×1000 at 25 fps, including the expanded public audit.
- `desktop-1440-initial.png`, `desktop-1440-kicklab-review.png`, `desktop-1440-typography-receipt.png`
- `desktop-1440-expanded-channel-scan.png`, `desktop-1440-expanded-candidate-examples.png`
- `tablet-768-kicklab-review.png`, `tablet-768-typography-receipt.png`, `tablet-768-expanded-candidate-examples.png`
- `mobile-390-kicklab-review.png`, `mobile-390-typography-receipt.png`, `mobile-390-expanded-candidate-examples.png`
- `thumbnail-feed-320x180.png` — raster thumbnail checked at feed scale.
- `results.json` — route, fixture, gate outcomes, allowed auth origin, blocked origins, and viewport overflow checks.
- `scripts/qa/record-kicklab-typography-review.mjs` reproduces the browser captures using the local gitignored `.auth/portfolio-admin-storage-state.json`. Convert its WebM source to the MP4 above with `ffmpeg -y -i <webm> -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart <mp4>`.

The capture server ran with `MOCK_N8N=true` and `N8N_DISABLE_OUTBOUND=true`; the browser harness used only the configured Portfolio Supabase origin for local session validation and blocked other origins (including Vercel Speed Insights). The only write was to the synthetic local QA fixture; external writes, provider, platform, upload, scheduling, publishing, and external-send actions were not performed.

## Visual checks

Rendered review surfaces, including the expanded audit and exact candidate records, were inspected at 1440×1000, 768×1024, and 390×844. Each reported no horizontal document overflow. The 320×180 thumbnail inspection confirms the single-line headline remains readable and the supplied real gameplay screenshot remains visibly distinct from the photographic backdrop. This is a review-quality observation, not performance evidence.

## Status

Phase 4 of 5: expanded public typography audit. This phase is complete; one phase remains: captain review of the scoped PR. Typography approval remains blocked pending at least four attributable exact-style examples and a same-channel age-normalized cohort at the unchanged 1.5× threshold. No human-approval or production action is requested by this packet.
