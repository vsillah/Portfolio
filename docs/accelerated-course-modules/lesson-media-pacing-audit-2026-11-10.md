# Accelerated lesson media: pacing and on-screen copy audit

This is a source-bound audit of the 16 learner-player MP4s in `public/accelerated/visual-parity`. The public lesson bindings were not changed. I compared the current visual-parity receipt with the approved native composites and inspected L01 at 00:36. The current renderer copies each native audio and subtitle stream; its visual remaster does not fill the silent teaching windows.

## Method and limit

`ffmpeg silencedetect=noise=-38dB:d=2` measured audio below the threshold in each current MP4. The figures below include trailing end-card silence and may miss quiet speech above the threshold. The source manifest and native composite timeline identify presenter windows; the long spans between them are intended teaching scenes, not marked learner-work pauses. The authored VTT already carries narration cues across these silent spans, so the caption stream describes speech that is absent from the audio. These are media defects, not a player volume setting.

| Lesson | Duration | Unintended teaching silence (start–end) | Total detected silence |
| --- | ---: | --- | ---: |
| L01 | 09:00 | 00:31.5–03:55.0; 04:07.9–05:45.0; 05:58.9–08:35.0 | 07:47.6 |
| L02 | 10:00 | 00:29.6–03:00.2; 03:13.8–06:06.4; 06:15.7–09:34.4 | 08:54.9 |
| L03 | 09:00 | 00:22.0–02:54.3; 03:10.5–05:49.3; 05:59.9–08:34.3 | 07:59.4 |
| L04 | 10:00 | 00:25.7–02:45.0; 02:58.8–05:50.0; 06:05.2–09:32.9 | 08:53.0 |
| L05 | 10:00 | 00:19.0–03:20.3; 03:40.7–06:40.2; 06:54.0–09:34.2 | 08:56.4 |
| L06 | 11:00 | 00:20.6–03:40.3; 03:56.6–07:20.2; 07:33.1–10:31.1 | 09:55.6 |
| L07 | 10:00 | 00:17.8–03:20.2; 03:34.3–06:40.2; 06:51.7–09:30.2 | 09:01.1 |
| L08 | 12:00 | 00:28.0–04:00.5; 04:17.8–08:00.2; 08:15.2–11:21.3 | 10:38.4 |
| L09 | 11:00 | 00:22.6–03:40.3; 04:01.0–07:20.2; 07:36.3–10:30.9 | 09:46.0 |
| L10 | 09:00 | 00:25.7–03:00.3; 03:19.8–06:00.2; 06:22.1–08:31.7 | 07:33.1 |
| L11 | 10:00 | 00:21.2–03:20.3; 03:41.1–06:40.2; 07:01.9–09:21.7 | 08:37.7 |
| L12 | 11:00 | 00:24.2–03:40.3; 04:01.1–07:20.2; 07:40.5–10:22.9 | 09:32.1 |
| L13 | 11:00 | 00:27.7–03:46.3; 04:06.1–07:26.2; 07:51.4–10:32.5 | 09:30.4 |
| L14 | 08:00 | 00:26.0–02:44.3; 03:08.8–05:30.3; 05:52.1–07:31.7 | 06:31.1 |
| L15 | 12:00 | 00:25.5–04:03.4; 04:27.7–08:01.3; 08:28.7–11:28.3 | 10:22.9 |
| L16 | 08:00 | 00:28.3–02:41.2; 03:06.9–05:16.2; 05:41.2–07:29.7 | 06:18.3 |

L01 at 00:36 illustrates the copy issue. The frame stacks “The blank document,” “Q3 Innovation Plan,” three worksheet fields, “Decision File cover sheet and data-use boundary,” `L01 / 01`, the brand line, and six scene progress dots. The bottom caption band is reserved, but captions compete with the amount of reading above it. The reusable frame renderer adds the artifact line, technical scene code, and dots to all 98 teaching scenes. Other scene cards and source plates still need a visual pass at desktop and narrow mobile widths after narration is repaired.

## Smallest coherent repair

1. Build a **local L01 review composite** first. Keep the native presenter pixels and audio in their exact windows. Add continuous, sentence-complete narration only in the three off-screen teaching spans. Regenerate timed captions against that actual mix. A silence longer than 12 seconds requires an explicit learner-work marker and timecode.
2. Simplify the shared teaching-frame chrome: one scene title and one visual idea at a time. Remove technical scene codes, repeated artifact labels, and decorative progress dots from the media image; navigation remains in the player. For L01-01, let the synthetic Q3 page carry the blank decision line without three competing worksheet fields. Keep the book/SAM source art and synthetic-example boundaries.
3. Use the L01 approval to apply the same narration and frame contract to L02–L16. Validate each against its source script, presenter windows, captions, frame count, silence report, and browser caption/control safe area. The current MP4s and learner bindings stay in place until that full set is reviewed.

The native presenter audio is the identity anchor. A locally synthesized voice can test timing and captions, but it is a **provisional review voice**, not a release voice or a substitute for a voice decision.
