# Accelerated course entry QA

The walkthrough and screenshots were captured from the exact localhost route
`/accelerated/learningplan?revision=ed8cc936` at 1440 x 900 and 390 x 844.
They show the L07 guided video already open beside the active course work on
desktop and immediately above its Decision File worksheet on mobile, without an
intermediate watch action. The learner entry
is synthetic and remains in browser-local guest storage; no learner or assessment
record was submitted.

`accelerated-course-entry-walkthrough.mp4` is a 12-second, silent H.264 MP4
at 1280 x 720. Its SHA-256 is
`01df59541d9ea4db8f1998daef9a86c10227773c98ee61d27c6c97f0570c9b2a`.

The authenticated persistence behavior is covered by focused API, component,
and migration tests. The new atomic assessment-intake function was validated on
staging only with synthetic rows inside a rolled-back transaction. No production
migration or real learner submission was performed.
