# Accelerated course entry QA

The walkthrough and screenshots were captured from the exact localhost route
`/accelerated/learningplan?revision=654d52d2` at 1440 x 900 and 390 x 844.
They show the L07 guided video directly beside the active course work on desktop
and immediately above its Decision File worksheet on mobile. The learner entry
is synthetic and remains in browser-local guest storage; no learner or assessment
record was submitted.

`accelerated-course-entry-walkthrough.mp4` is a 12.33-second, silent H.264 MP4
at 1280 x 720. Its SHA-256 is
`af18dd571bfb5577772e6a4ca1396f21ad663830b70edeb2a1fbdbcfd416bc57`.

The authenticated persistence behavior is covered by focused API, component,
and migration tests. The new atomic assessment-intake function was validated on
staging only with synthetic rows inside a rolled-back transaction. No production
migration or real learner submission was performed.
