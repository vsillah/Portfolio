# Agentified L01 Gray Sweater learner binding

Review commit: `486436af72c432b6960fb95b27d669d344f144e7`

Review route:

`http://127.0.0.1:3161/agentified/learningplan?lesson=L01&revision=486436af72c432b6960fb95b27d669d344f144e7`

## Approved media

- Native source SHA-256: `5b1c3ecb2b741f16105a8695e61f0d2d067ee8988a0626f800e0699d5b4f211c`
- Composite SHA-256: `bec9f2910b638bae91c3ba11c61a9ff1a7175ad5639d713a629b4c21553c7345`
- Served captions SHA-256: `b40b954f06a6aed2305b0389002718a8de576a8be8746f3de5a9b93d177f5ae0`
- Lesson duration: 540 seconds

## Captain validation

- Focused media and learner tests: 8 passed
- Production build: passed with `NODE_OPTIONS=--max-old-space-size=8192`
- Desktop: 1440 x 900, no horizontal overflow
- Tablet: 820 x 1000, no horizontal overflow
- Mobile: 390 x 844, no horizontal overflow
- Direct L01 playback and English captions: passed
- Transcript disclosure: passed
- L05 locked-video state: passed
- Operating File round trip to L01: passed
- External HTTPS requests during capture: blocked

## Walkthrough evidence

- `desktop-walkthrough.mp4`: H.264, 1440 x 900, SHA-256 `f05cd55f156450e8d03bd92efa6fc185d1242b739df8cbc87a9453c7fb86857e`
- `mobile-walkthrough.mp4`: H.264, 390 x 844, SHA-256 `9383271ceba23447ec1f13d74ff0d6ab83dc1e95613a0d7a3974afcb1ef79586`

The capture used guest-only local state. It did not claim progress, submit worksheet data, call a provider, or mutate production data.
