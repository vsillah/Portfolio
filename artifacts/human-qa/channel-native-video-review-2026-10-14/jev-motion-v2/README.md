# Jev motion v2 deployed review evidence

Human QA remains pending. This packet replaces the rejected static-timeline evidence with a substantive, provider-free motion composition shown on the exact deployed Social Content review route.

## Review target

- Route: `https://portfolio-git-codex-channel-native-vid-e66b20-vsillahs-projects.vercel.app/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=copy&qa_fixture=channel_native_video_v2`
- Git commit exercised: `087b4247`
- Fixture binding: `qa_fixture=channel_native_video_v2` (authenticated, read-only, known Jev fixture only)
- Motion profile: `jev_decision_flow_v2`
- Customer asset: 1080x1920, 30 fps, 660 frames, 22 seconds, H.264 with silent AAC track
- Customer asset SHA-256: `191d1d99c00688aba025c13bfbace887c647e36cc67e47dcbaaa0902614ca92e`
- Poster SHA-256: `7709869d1d3f6d219128d5f47d0e5c3701c39a5079c4cf9378d2f958cd124a97`

## Evidence files

- `jev-deployed-review-walkthrough.mp4`: 1440x900, 4.8 fps, 126 frames, 26.25 seconds, H.264. SHA-256 `4c741a98b9a75a5e3cab67f343073866ad05d810a478ec61a1c737b6fb1302a8`.
- `jev-deployed-motion-review.png`: desktop deployed motion frame. SHA-256 `47f47aea3fbb53e0faecff12bcb7bd4d5599124338bed0d976d5256c4be4f12c`.
- `jev-deployed-receipts.png`: deployed source, voice, framework, privacy, visual, rights, challenger, and script-quality receipts. SHA-256 `58f3e3906443b90053ebaaf81aa0731fa58e2a61f12abaa73fac5258e0ce313b`.
- `jev-deployed-mobile.png`: narrow-width layout with the 22-second duration and video receipt visible. SHA-256 `2a4f1176b40f6828680c98b360f97971cb98156f1512353ef16773658ed2f108`.

## Gates and boundaries

- The six customer-facing scenes are distinct temporal states; this is not the LinkedIn still placed on a video timeline.
- No approved clip-level avatar or talking-head rights receipt was found for Jev. The avatar source gate is therefore `not_bound`; no presenter footage was inferred or reused.
- No synthesis provider, upload, platform draft, scheduling, publishing, external send, database mutation, or shared-row write occurred.
- All six execution controls remain disabled on the deployed route.
- Dark Castle assets were not changed.

