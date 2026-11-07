# Phase 5 first-batch walkthrough

- Source commit: `87f8fa62a11102ce8ab44520eff0c8ae1e27094f` on `codex/agentified-phase5-production-packets`.
- Review route: `http://127.0.0.1:4174/agentified/workshop/scene-production/review.html?lesson=L01&rev=87f8fa62a11102ce8ab44520eff0c8ae1e27094f` (switch the lesson selector through L04).
- Artifact: `agentified-scene-walkthrough-l01-l04-87f8fa62.mp4`.
- Capture: silent Playwright recording of the local review route, with desktop L01–L04 and mobile L01/L04. Each lesson shows its opening, an approved plate, and its closing. No provider, avatar, voice, private account, or live data was used.
- Encoding: H.264, 1280×800, 32.32 seconds, 808 frames. Full-file FFmpeg decode passed; desktop and mobile frames were visually inspected.
- Customer-facing status: **editorial hold**. The MP4 is an internal production walkthrough. See `../customer-copy-review.md` before any spoken or customer-facing release.

Reproduce from the repository root while its static server is listening on port 4174:

```bash
node agentified/workshop/scene-production/record-walkthrough.mjs 87f8fa62a11102ce8ab44520eff0c8ae1e27094f L01-L04 http://127.0.0.1:4174/agentified/workshop/scene-production/review.html
```
