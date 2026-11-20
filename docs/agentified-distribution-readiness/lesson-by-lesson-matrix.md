# Lesson-by-lesson matrix

All paths, expected/actual SHA-256 values, sizes, duration and existence checks are in `manifest.json`. Each lesson has eight content segments, a poster, VTT track, source video and bound illustrated MP4. “Present” means file/hash and static binding verification only; it is not a fresh visual, audio or mobile pass.

| Lesson | Topic | Duration (s) | Diagrams | Media/binding | End screen | Focus for next qualification |
| --- | --- | ---: | ---: | --- | --- | --- |
| L01 | Give the agent a job and a receipt | 378.059 | 1 | Present; hash and source match | Missing | Resolve missing end screen; then inspect illustrated media and caption overlap |
| L02 | Start with the decision | 510 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L03 | Trace the work and grade the sources | 600 | 1 | Present; hash and source match | Bound | Check long-form pacing, transcript and mobile caption placement |
| L04 | Turn feedback into governed memory | 600 | 1 | Present; hash and source match | Bound | Check long-form pacing, transcript and mobile caption placement |
| L05 | Map the operating system | 237.687 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L06 | Write the permission slip | 258.96 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L07 | Specify the work and the team | 251.332 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L08 | Make handoffs testable | 257.68 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L09 | Measure trust and choose review posture | 272.84 | 2 | Present; hash and source match | Bound | Check both bound diagrams for mobile legibility and presenter/caption collision |
| L10 | Gate spend and brief the decision | 274.28 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L11 | Run the cockpit and unblock lane | 252.92 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L12 | Prove the work safely | 268.12 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L13 | Research with a gate | 255.243 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L14 | Show the board the controls | 241.762 | 2 | Present; hash and source match | Bound | Check both bound diagrams for mobile legibility and presenter/caption collision |
| L15 | Rehearse the agentified day | 255.386 | 1 | Present; hash and source match | Bound | Confirm visual/caption quality and contextual whole-lesson desktop/mobile behavior |
| L16 | Audit the operating file | 267.309 | 2 | Present; hash and source match | Bound | Check both bound diagrams for mobile legibility and presenter/caption collision |

Source files: `lib/agentified-workshop-content.json`, `lib/agentified-source-media.ts`, the five `lib/agentified-l*-media.ts` modules, `lib/agentified-illustrated-bindings.json`, `lib/agentified-end-screens.ts`, and `lib/agentified-lesson-posters.ts`. The historic visual defect detail is in `agentified/workshop/presentation-illustration-audit/defect-matrix.md`.
