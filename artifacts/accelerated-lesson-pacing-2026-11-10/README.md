# L01 local pacing review

This package is a **local review candidate**. It does not change the learner-player binding, provider state, or production media. The source is the approved L01 visual-parity MP4 identified by `review-receipt.json`. The teaching words come from its approved VTT; the presenter video and native audio stay in their recorded windows. The off-screen teaching track uses the macOS `Samantha` system voice to prove timing only. Its voice identity and performance are **not approved for release**.

The clean frame applies only when the presenter is off screen. Native presenter frames still show `SCENE 03` at 04:00 and `SCENE 06` at 08:48; the 04:00 SAM plate and adjacent heading also carry substantial text. This local proof resolves the silence and the first cutaway card, **not** all visible production labels. A safe presenter-frame overlay or source-background redesign remains a separate visual QA task.

## Watch

- `l01-candidate-025-to-105.mp4` is the **primary 40-second narrated review clip** from source 00:25–01:05, with its caption stream. At source 00:36 the candidate removes the scene code, repeated artifact line, progress dots, and two worksheet fields. At source 00:45 the page changes to the decision question.
- `l01-before-after-025-to-100.mp4` is an optional 70-second comparison. The **first 35 seconds** show the silent current L01 at 00:25–01:00; the **next 35 seconds** show the candidate at the same source time. The seam is at 00:35 in the comparison clip.
- `l01-continuous-review.mp4` is the local proof with a provisional voice and newly timed VTT/mov_text captions. It ends at **08:49.48**, after the native presenter close, because the source's unmarked 10.84-second silent end-card tail is a pacing defect. Any later learner-player binding must account for this reviewed duration change or supply an approved spoken close.

## Rebuild and checks

From the Portfolio root on macOS, with `ffmpeg`, `ffprobe`, Python 3, Pillow, and the system `say` voice available:

```bash
python3 scripts/qa/build-accelerated-l01-pacing-review.py
```

The script verifies the immutable source hash, 13,237 video frames at 25 fps, 529.48-second review duration, MP4 decode, **no unmarked silence above two seconds**, no caption gap above two seconds, and no caption overlap above 0.1 seconds. Four native presenter frame samples differ from the source by less than one RGB level on average after video re-encoding. Its receipt records input/output hashes, native presenter windows, voice source durations, and the regenerated caption file. Both short MP4s were decoded with FFmpeg after render.

Before a release candidate, replace the provisional system voice with an authorized narration source, align the captions to that final mix, review presenter transitions by ear and frame, and inspect desktop/mobile caption clearance. Apply the same contract to L02–L16; the shared clean-frame option already removes the repeated code, artifact line, and dots for any lesson, but those lessons are not rendered or rebound here.
