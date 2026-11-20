# Phase 3B media review candidates

These are local, provider-free review files. They are not learner bindings or Human QA walkthroughs.

| Lesson | Full review candidate | Contextual windows |
| --- | --- | --- |
| L01 | Current bound original; only duration metadata and UI end-screen binding changed | `L01-setup` 00:00–00:30; `L01` 05:49–06:18.28 |
| L10 | `L10/agentified-l10-caption-timed-composite.mp4` with corrected optional VTT and embedded track | `L10-teaching` 02:00–02:30; `L10` 02:46–03:16 |
| L16 | `L16/agentified-l16-resting-composite.mp4` with source-bound presenter-free closing card | `L16-guided` 03:22–03:52; `L16` 04:07–04:35.32 |
| L02 | Existing bound original, read-only | `L02-adjacent` 00:00–00:12, to inspect the L01 next-lesson continuity; no L02 correction implied |

`contextual/` contains 1280×720 desktop and 390×844 mobile MP4s for every row/window. Each MP4 has an optional embedded caption track. Matching time-shifted VTT sidecars document the exact visible cues and allow captions to be toggled on or off in a compatible player. All fourteen files decoded cleanly, their video dimensions and durations were probed, and no cue extends past its clip.

The mobile clips letterbox the complete 16:9 media inside 390×844 so no scene copy is cropped. These media-only clips show contextual setup, teaching, guided work, ending, and adjacent continuity. They do not show the Learning Plan controls, replay, seek, manual completion, or the actual browser caption-toggle interaction. The L01 localhost route was separately inspected at desktop and 390×844; its end-screen and native control clearance passed visual inspection. A route screen recording remains required before Vambah's Human QA.

Rebuild with `bash docs/agentified-distribution-readiness/phase-3b/render_context_clips.sh`. Candidate sources are rebuilt with `remux_l10_caption.sh` and `render_l16_rest.sh` in the same directory. Keep all candidate files unbound until the separate Phase 3 integration and review gates pass.
