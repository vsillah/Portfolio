# Authenticated campaign review QA

Captured on 2026-10-20 from the authenticated, read-only Portfolio localhost route at UI commit `9d7ab059`:

`http://127.0.0.1:5319/admin/social-content?campaignQa=campaign-package-preparation-review-v1&rev=9d7ab059`

The in-app Browser loaded **Long-form scripts and production cues** for Dark Castle Chess and AI Audit Calculator. The selected Candidate A thumbnails, rejected Candidate B receipts, spoken scripts, scene cues, public description source logic, and `Unscored · 1/3` states were visible. The server ran from this worktree with `MOCK_N8N=true` and `N8N_DISABLE_OUTBOUND=true`.

## Rendered checks

| Width | Evidence | Result |
| --- | --- | --- |
| 1280×720 | `final-desktop-*.jpg`, `authenticated-route-desktop-walkthrough.mp4` | Both selected campaign cards and expanded script/source states rendered without page overflow. |
| 820×800 | `final-mid-*.jpg` | Campaign card and responsive source cards rendered without page overflow. |
| 390×844 | `final-mobile-*.jpg`, `authenticated-route-mobile-walkthrough.mp4` | Both campaign cards and stacked source cards rendered without page overflow. |

The browser's `document.documentElement.scrollWidth` equaled `innerWidth` at all three widths. The mobile source cards replaced a clipped five-column table found during QA. The disclosure controls for retention, spoken scripts, scene cues, and description sources were exercised on the actual route. The two description cohorts remain **Unscored**, with one qualifying full description each against a required minimum of three.

The MP4s are silent sequences of actual in-app Browser screenshots taken after those route interactions. Each captured state holds for four seconds. They are UI walkthrough evidence, not a rendered campaign video or a continuous screen recording. No account menu, credential, private message, customer record, or unrelated tab appears in the frames.

## MP4 validation and reproduction

`ffprobe` reports H.264 at 30 fps and 1280×720 for the 32-second desktop MP4; H.264 at 30 fps and 390×844 for the 16-second mobile MP4. Representative frames from each encoded MP4 were decoded and visually inspected for legibility.

From this directory, reproduce with:

```bash
ffmpeg -f concat -safe 0 -i desktop-frames.txt -vf fps=30,format=yuv420p -c:v libx264 -crf 20 -preset veryfast -movflags +faststart authenticated-route-desktop-walkthrough.mp4
ffmpeg -f concat -safe 0 -i mobile-frames.txt -vf fps=30,format=yuv420p -c:v libx264 -crf 20 -preset veryfast -movflags +faststart authenticated-route-mobile-walkthrough.mp4
```

## Boundary

No provider generation, upload, platform draft, scheduling, publication, production mutation, credential change, migration, spending, or external send was performed. This QA does not qualify either description cohort or grant execution authority. Vercel checks and the in-app Browser route are separate evidence; the MP4 shows localhost UI behavior at the stated UI commit.
