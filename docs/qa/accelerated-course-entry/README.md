# Accelerated course entry QA

The walkthrough and screenshots were captured from the exact localhost route
`/accelerated/learningplan?revision=a54f9cf0c0bea99ba80ce64e2e28aa0b7f593498`
at desktop and 390 x 844 mobile widths. They show the compact lesson rail, the
guided video already open beside the active course work, the icon-only worksheet
and lesson controls, and the reduced copy treatment. Internal status and
persistence explanations, redundant workbook navigation, and visual captions
are absent while the learner actions remain available. The learner entry is
synthetic and remains in browser-local guest storage; no learner or assessment
record was submitted.

`accelerated-course-entry-walkthrough.mp4` is a 5.28-second, silent H.264 MP4
at 1280 x 720. Its SHA-256 is
`6864cdc87da51a0b207c368db4dc634246aa3da0e32566bd9c3de51c1c83e7a5`.

The authenticated persistence behavior is covered by focused API, component,
and migration tests. The new atomic assessment-intake function was validated on
staging only with synthetic rows inside a rolled-back transaction. No production
migration or real learner submission was performed.
