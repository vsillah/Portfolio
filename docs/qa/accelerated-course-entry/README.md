# Accelerated course entry QA

The walkthrough and screenshots were captured from the exact localhost route
`/accelerated/learningplan?revision=00a1e69dd4433c041d6eac8bd1e7c1a52e705219`
at desktop and 390 x 844 mobile widths. They show the compact lesson rail, the
guided video already open beside the active course work, the icon-only worksheet
and lesson controls, and the reduced copy treatment. Internal status and
persistence explanations, redundant workbook navigation, standalone framework
visuals, duplicate practice cards, and visual captions are absent while the
learner actions remain available. The learner entry is
synthetic and remains in browser-local guest storage; no learner or assessment
record was submitted.

`accelerated-course-entry-walkthrough.mp4` is a 5.20-second, silent H.264 MP4
at 1280 x 720. Its SHA-256 is
`e3f6ae4b99b065d1306573bff6adb37fc0b9e2bbcd7fa27fa3bc812bdb6c1be9`.

The authenticated persistence behavior is covered by focused API, component,
and migration tests. The new atomic assessment-intake function was validated on
staging only with synthetic rows inside a rolled-back transaction. No production
migration or real learner submission was performed.
