# L01 local pacing review

This package is a **local review candidate**. It does not change the learner-player binding, provider state, or production media. The source is the approved L01 visual-parity MP4 identified by `review-receipt.json`. The teaching words come from its approved VTT; the presenter video and native audio stay in their recorded windows. The off-screen teaching track uses the macOS `Samantha` system voice to prove timing only. Its voice identity and performance are **not approved for release**.

The clean frame applies only when the presenter is off screen. L01-02 now holds one approved Signals plate; L01-03 progresses through the approved Signals, Alignment, and Momentum plates instead of shrinking the full infographic beside three extra labels. The 04:00 native presenter audio discusses **Sam, the book's teaching character**, so that presenter window now shows the source-script line “Sam is a teaching story” instead of the unrelated miniature SAM map. The presenter inset and native audio remain in their original windows. A review-only top-right mask also removes the four `SCENE` labels. `review-receipt.json` records hashes for the original full infographic and each approved focus plate; the public source is unchanged.

## Watch

- `l01-candidate-025-to-105.mp4` is the **primary 40-second narrated review clip** from source 00:25–01:05, with its caption stream. At source 00:36 the candidate removes the scene code, repeated artifact line, progress dots, and two worksheet fields. At source 00:45 the page changes to the decision question.
- `l01-before-after-025-to-100.mp4` is an optional 70-second comparison. The **first 35 seconds** show the silent current L01 at 00:25–01:00; the **next 35 seconds** show the candidate at the same source time. The seam is at 00:35 in the comparison clip.
- `l01-focus-0250-to-0410.mp4` shows the revised SAM map cards and the 04:00 presenter treatment in one 80-second candidate clip, with captions.
- `l01-0400-before-after.mp4` is a 20-second comparison of source 03:58–04:08: ten seconds of the original dense presenter plate followed by ten seconds of the local treatment.
- `l01-continuous-review.mp4` is the local proof with a provisional voice and newly timed VTT/mov_text captions. It ends at **08:49.48**, after the native presenter close, because the source's unmarked 10.84-second silent end-card tail is a pacing defect. Any later learner-player binding must account for this reviewed duration change or supply an approved spoken close.

## Rebuild and checks

From the Portfolio root on macOS, with `ffmpeg`, `ffprobe`, Python 3, Pillow, and the system `say` voice available:

```bash
python3 scripts/qa/build-accelerated-l01-pacing-review.py
```

The script verifies the immutable source hash, 13,237 video frames at 25 fps, 529.48-second review duration, MP4 decode, **no unmarked silence above two seconds**, no caption gap above two seconds, and no caption overlap above 0.1 seconds. The second presenter background intentionally changes, so full-frame error at 04:00 is expected; the protected presenter inset stays below two RGB levels of mean error after re-encoding. Its receipt records source-art and input/output hashes, native presenter windows, voice source durations, and the regenerated caption file. All MP4s were decoded with FFmpeg after render.

`qa-label-samples/l01-0300-map-focus-before-after.png` and `qa-label-samples/l01-0400-story-focus-before-after.png` show the two density repairs. `qa-label-samples/l01-before-after-labels.png` samples all four presenter labels. `qa-label-samples/contact-top-right.png` compares presenter labels in L01, L02, L08, and L16; their different placement prevents reuse of L01 mask coordinates without per-lesson inspection.

`caption-viewport-check.json` records settled Chromium captures at 03:01 and 04:01 in **1440×900 desktop** (960 px player) and **390×844 narrow** (350 px inline player) viewports. Playback had `readyState=4`, a rendered frame callback, and an active cue; the four `qa-label-samples/*-caption-*-settled.png` captures have no buffering spinner. In those samples, short top-right captions clear the brand, focused art, and presenter inset. The narrow inline caption font is still small. **Fullscreen/mobile legibility, native player controls, and final-voice cue timing remain release gates.** The Chromium check used the external VTT; embedded `mov_text` placement may vary by player and needs separate qualification.

Before a release candidate, replace the provisional system voice with an authorized narration source, align the captions to that final mix, review presenter transitions by ear and frame, and qualify mobile caption legibility. Apply the same contract to L02–L16; the shared clean-frame option already removes the repeated code, artifact line, and dots for any lesson, but those lessons are not rendered or rebound here.
