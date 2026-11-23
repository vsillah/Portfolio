# Agentified L16 learner-route qualification

Code under review: `44205e9fc2c00a80223dd8f79878158fa612cbce`, stacked on draft PR #1302 at `3083a3cc2e7cf24a70d9b15b860a8992b69f5a6d`.

The explicit L16 URL had been overwritten by the stored member `current_lesson_id` when the asynchronous account fetch completed. That made the previous authenticated recording show L01. The L16 mobile player entered its playing state in a direct route check; no independent player change was needed. The component now honors a valid explicit lesson query during both local and member restoration. Its existing saved video position remains lesson specific.

Review route: `http://127.0.0.1:3138/agentified/learningplan?lesson=L16&rev=44205e9fc2c00a80223dd8f79878158fa612cbce`. The local server was restarted from this exact branch and commit. The in-app browser was unavailable in this session; the exact route was left open in a durable Chrome tab as the fallback.

## Validation

- Focused Agentified workshop/player and credential UI/API tests: 79 passed. Standalone TypeScript check passed.
- Production build passed with `NODE_OPTIONS=--max-old-space-size=8192`. The default 4 GB Node heap exhausted after compilation; the larger-heap retry completed.
- Qualified binding verifier passed 13 lesson bindings. No media or caption file changed.
- Staging migrations `20261123131017` and `20261123133454` were present. Claim and link functions allowed service-role execution while denying anon and authenticated execution.
- Rollback-only staging SQL lifecycle passed. The final synthetic HTTP lifecycle passed all 11 checks in [credential-http-receipt.json](credential-http-receipt.json).
- Exact learner route passed L16 selection, play, pause, seek, captions on/off, Small/Medium/Large caption sizes, end screen, and replay at 1280×800 and 390×844. See [learner-route-receipt.json](learner-route-receipt.json).
- Authenticated credential and L16 recordings passed at 1440×900 and 390×844. Both MP4s were decoded and visually inspected at the L16 playback window; no horizontal overflow was observed.
- Synthetic sessions were revoked and the account deleted. Cleanup queries returned zero user-keyed enrollments, lessons, worksheets, commands, credentials, and decision-file owners. An independent read returned zero matching auth users, credentials, and intakes. The private session file was removed.

| MP4 | SHA-256 |
| --- | --- |
| `desktop-credential-walkthrough.mp4` | `8b9c46c42d7cff170dc02da70c99664399c6008effe4488c94aba47d4f359e64` |
| `mobile-credential-walkthrough.mp4` | `f699bcdeca4aa353581387c2989e580bd54a7cbbc12b6b3fa02d95b9e1493bd4` |
| `desktop-l16-controls.mp4` | `fa96e225e0d5ca37146561fcee8a9377cafd30f8cacbc953564eadc27c7fac33` |
| `mobile-l16-controls.mp4` | `7778bf55af4bc592c641110de94c45d3d5a4c2ade9b959ba27e81684281566aa` |

All captures use synthetic staging data or the guest route. They are silent screen recordings and contain no credential values. No production action, deployment, merge, provider contact, or release occurred.
