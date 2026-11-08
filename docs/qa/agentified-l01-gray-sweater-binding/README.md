# Agentified L01 Gray Sweater learner binding

Review commit: `860c27b613cba557178e4b7657d9b84eb19fb87b`

Review route:

`http://127.0.0.1:3162/agentified/learningplan?lesson=L01&revision=860c27b613cba557178e4b7657d9b84eb19fb87b`

## Approved media

- Native source SHA-256: `5b1c3ecb2b741f16105a8695e61f0d2d067ee8988a0626f800e0699d5b4f211c`
- Composite SHA-256: `57c2907224e9ac15e304bb4c43b47f8881c8eb09ecab293d02c92d5958b306ce`
- Served captions SHA-256: `b40b954f06a6aed2305b0389002718a8de576a8be8746f3de5a9b93d177f5ae0`
- Lesson duration: 540 seconds

## Captain validation

- Focused media and learner tests: 8 passed
- Production build: passed with `NODE_OPTIONS=--max-old-space-size=8192`
- Desktop: 1440 x 900, no horizontal overflow
- Tablet: 820 x 1000, no horizontal overflow
- Mobile: 390 x 844, no horizontal overflow
- Direct L01 playback and English captions: passed
- Native facial detail at 00:10: passed
- Opening sentence handoff crossfade at 00:13.633: passed
- Closing presenter handoff crossfade at 08:41.593: passed
- Transcript disclosure: passed
- L05 locked-video state: passed
- Operating File round trip to L01: passed
- External HTTPS requests during capture: blocked

## Walkthrough evidence

- `desktop-walkthrough.mp4`: H.264, 1440 x 900, 14.24 seconds, SHA-256 `a28ad78362cb73de16f27c6f7f5bb3fea807f662154232e40878c59e5b30c306`
- `mobile-walkthrough.mp4`: H.264, 390 x 844, 13.76 seconds, SHA-256 `df287b7864fcdda05451726d51e6383fd2d1b5bc0bc2dda567e6b20c67562269`

The capture used guest-only local state. It did not claim progress, submit worksheet data, call a provider, or mutate production data.
