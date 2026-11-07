# Adult activation preview walkthrough

Product source commit: `1bf84236ab4aaadc1d39597d6057420ebc7141c3`

Review route: `http://localhost:3287/activate/trumpet-trainer?revision=1bf84236ab4aaadc1d39597d6057420ebc7141c3`

Entry route: `http://localhost:3287/work/trumpet-trainer?revision=1bf84236ab4aaadc1d39597d6057420ebc7141c3#interest`

The desktop dark and 360 px mobile light MP4s start at the product interest entry, follow the adult consent link, show consent and closed intake, and show invitation and app handoff controls. They use a local production build with synthetic public Supabase placeholders and all activation and outbound switches off. No adult email, invitation token, child record, or account appears in either recording.

To reproduce from the source commit, start `next start` on port 3287 with activation disabled, run:

```bash
node docs/qa/adult-activation/capture.mjs 1bf84236ab4aaadc1d39597d6057420ebc7141c3 http://localhost:3287
ffmpeg -i docs/qa/adult-activation/1bf84236/desktop-dark-source.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart docs/qa/adult-activation/1bf84236/desktop-dark.mp4
ffmpeg -i docs/qa/adult-activation/1bf84236/mobile-light-source.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart docs/qa/adult-activation/1bf84236/mobile-light.mp4
```

The capture script fails if intake, redemption, or handoff is enabled or if horizontal overflow is present. The MP4s were probed for H.264, dimensions, duration, and playable frames; initial and final frames were visually inspected. Live invitation and grant behavior remain untested because provider and app integration are disabled.
