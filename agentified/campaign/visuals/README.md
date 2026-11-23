# Agentified social visual review pack

Internal review assets for `AW-IG-CAR-01`, `AW-IG-CAR-02`, `AW-REEL-01`, `AW-REEL-02`, and `AW-YT-01`. Source copy and spoken scripts are in [`../draft-assets.md`](../draft-assets.md). The output is served at `/agentified/campaign-review/2026-11-23/index.html` in the local Portfolio app.

## Rebuild

From the Portfolio repository root, with Pillow and FFmpeg installed:

```bash
python3 agentified/campaign/visuals/build.py
```

The build reads owned workshop plates, lesson posters, and five captured public guest screens. The captures show an empty browser profile with no learner entries. They were taken from local `/agentified`, `/agentified/learningplan`, and `/agentified/operating-file` routes at base commit `f452b5b7f6cb44182d39be133fa8f82b37c5a2b6`, using inert Supabase placeholders and outbound n8n disabled. The manifest records all source and output SHA-256 hashes.

## Editorial limits

- The carousels use the seven approved script beats in order. Short clarifying subheads and line breaks were added for visual layout; check these against the copy before publication.
- Text plates size to their rendered lines with 30 px internal padding. Public guest screens are scaled to fit their complete source frame, preserving the Operating File title and controls.
- The two 40-second vertical MP4s are silent composition and pacing reviews. Their scene captions follow the spoken scripts, but no voice or music was generated.
- The five-minute YouTube MP4 is a silent screen-backed proof candidate. It uses complete public guest screenshots and long holds to preserve the planned section timing. It is not a finished episode or evidence of narrated interaction.
- The thumbnail is one internal concept. Campaign reuse of lesson publication plates and posters requires its own review; lesson-level approvals do not imply social publication approval.
- No provider calls, AI image generation, uploads, learner data, account capture, scheduling, or publishing were used.

## Review checks

Check the full diagrams at 1080 × 1350, title and call-to-action legibility at phone width, and that blank Operating File screens remain blank. Validate all MP4 dimensions, duration, and playability with `ffprobe`/playback before Human QA. The review page is a local artifact; the public call to action in the creative remains `amadutown.com/agentified`.

The desktop and mobile walkthroughs are silent scroll captures of the local review page. To regenerate them after rebuilding the page, recapture full-page screenshots at 1728 × 956 and 390 × 844 into `sources/review-desktop-full.png` and `sources/review-mobile-full.png`, then run `python3 agentified/campaign/visuals/walkthrough.py`.
