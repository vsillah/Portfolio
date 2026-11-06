# Accelerated course entry QA

The walkthrough and screenshots were captured from the exact localhost route
`/accelerated/learningplan?revision=c863968605d633893c5840b09efb42fff551f54b`
at desktop and 390 x 844 mobile widths. They show the compact lesson rail,
expanded lesson navigation with colored status pills, the guided video already
open beside the active course work, and the icon-only worksheet and lesson
controls with accessible labels and tooltips. The learner entry is synthetic
and remains in browser-local guest storage; no learner or assessment record was
submitted.

`accelerated-course-entry-walkthrough.mp4` is a 12-second, silent H.264 MP4
at 1280 x 720. Its SHA-256 is
`176df2508b1607d9f6ad9f3c3194229913c0d4ce0d1d1385965c1b2210cdb6af`.

The authenticated persistence behavior is covered by focused API, component,
and migration tests. The new atomic assessment-intake function was validated on
staging only with synthetic rows inside a rolled-back transaction. No production
migration or real learner submission was performed.
