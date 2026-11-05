# Accelerated L13–L16 learner binding QA

Source implementation commit: `d212d31d68a89b665a4d78221dcd6207acad1627`.
Exact local route: `http://127.0.0.1:3142/service-prototypes/accelerated-cohort?view=3&rev=d212d31d68a89b665a4d78221dcd6207acad1627`.

The privacy-safe MP4 is a sequence of screenshots captured from the rendered Learning plan in the integrated Codex browser at desktop width. It shows the L13–L16 player entries, caption controls, expanded transcripts, return state, and four-lesson progress. The composite footage is the exact approved local media; no provider job or external publication was triggered for this QA.

Additional screenshots cover tablet (768 px) and mobile (390 px) in light and dark themes. On mobile, L16 ready, player, transcript, and return were checked. The browser reported document scroll widths of 758 px at a 768 px tablet viewport and 380 px at a 390 px mobile viewport. The desktop and mobile player screenshots visually show the approved native composite in the video element.

Rebuild the MP4 with `docs/qa/accelerated-l13-l16-learner-binding/render-walkthrough.sh`. `ffprobe` reported 31.000 seconds and 1,462,961 bytes. This is a captured-state walkthrough, not a full-duration playback recording.
