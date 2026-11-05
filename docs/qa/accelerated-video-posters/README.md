# Accelerated illustrated lesson poster QA

L01–L16 now use sixteen new illustrated avatar covers based on an approved first-party Vambah likeness reference. Each poster also uses the owned book, SAM, or lesson storyboard art named in `source-map.json`. The likeness reference is used for identity guidance; the poster pixels are new illustration and deterministic composite work. The approved learner videos, narration, captions, timing, transcripts, and worksheet logic were not edited.

## Pre-flight and integration

- Base commit: `ed73dee795dbcb067bf441451c49190228d7518d` (`origin/main` when work began)
- Branch/worktree: `codex/accelerated-video-posters` at `/Users/vambahsillah/Projects/Portfolio.worktrees/accelerated-video-posters`
- Intended files: Learning Plan poster binding/test; poster URL map, generated assets, protected source map/prompt records, builder, and QA evidence.
- Open PR overlap: draft PR #1209 edits the same Learning Plan component and test. PR #1207 edits an Accelerated trace script but not this lane's files.
- High-conflict surfaces: Learning Plan component/test, `lib/`, and `scripts/`.
- Lane classification: **Dependent**. The Integration Captain should sequence PR #1209 and this lane and resolve the small player/test overlap before merge. No worksheet work was changed here.

## Evidence

- `generation-prompts.json` records each lesson prompt and generator job identity. `source-map.json` records the approved likeness reference path/hash, prompt identity/hash, avatar source path/hash, generation provenance, SAM/book asset path/hash, poster output hash/dimensions, privacy/rights status, lesson binding, and visual review.
- `all-sixteen-montage.png` shows the complete set at four-column scan size.
- Responsive screenshots cover representative L01 Signals, L05 Alignment, L11 Momentum, and L15 Synthesis states at 1440×900 desktop, 820×1180 tablet, and 390×844 mobile, each in light and dark themes.
- `accelerated-posters-walkthrough.mp4` shows the localhost Learning Plan path, the four acts, L01 playback starting, return to plan, and a mobile L16 cover.
- Exact captured URL: `http://localhost:3107/service-prototypes/accelerated-cohort?posterRev=d59315e95e6248f95949ff0f1d9b3ada8a57b490`, with the Learning plan tab selected.

## Validation

- `npx vitest run 'lib/accelerated-lesson-posters.test.ts' 'app/service-prototypes/[slug]/AcceleratedLearningPlan.test.tsx'` — 10 passed. These cover sixteen distinct 1280×720 posters, exact source and prompt hashes, each native `poster` binding, existing video/caption URLs, and return/reset behavior.
- `git diff --name-only origin/main -- public/accelerated/lessons docs/accelerated-course-modules` — empty.
- The encoded MP4 was probed for playback and representative frames were visually inspected.
- `npx tsc --noEmit --pretty false` fails on existing errors outside this lane, including admin/social tests and a missing generated chatbot knowledge module. No error referenced the changed poster files.

The captures use public or synthetic course content. No provider video, production data, external send, upload, or publication was exercised.
