# L01 always-visible caption preview: captain follow-up

**Status:** review only; Human QA pending. Captain inspection was bound to draft PR #1270 at `bd672b473ceb504ef7a75012e57d76993ac7280e`, the local [preview](http://127.0.0.1:54582/review.html?rev=bd672b473ceb504ef7a75012e57d76993ac7280e), approved local MP4 SHA-256 `80a1be496b7b05e1ae7bf6bff2cd00e2410374e6c8abe65e280fe7e4c444d0d1`, and caption-plan SHA-256 `d917317e98f7dc05590e714097af9faf00a9c09236ce894a18c214ce9138b21e`. Both source hashes and the 175-cue deterministic build check were reverified before this receipt.

## Observed keyboard and accessibility-tree path

In the in-app browser, the captain used Tab to focus the collapsed **Read the complete L01 transcript** control and Enter to expand it. The accessibility tree exposed 175 named timestamp-seek buttons. This is a partial keyboard/AX pass. It does not establish VoiceOver pronunciation, reading order during playback, focus recovery after seeking, or physical-device access. The earlier [browser review](browser-review.json) covers desktop and 390×844 layout, native controls, section seeking, no second video caption track, and the opt-in read-along.

## Recording blocker and exact retry

No MP4 walkthrough exists. Through the current computer-use surface, the captain tried **QuickTime Player → File → New Screen Recording** and macOS **Shift–Command–5**; neither exposed a usable capture flow. The available computer-use API provided screenshots and UI interaction but no video-recording capability. Do not treat this receipt or the screenshots as the required playable walkthrough.

To reproduce from this worktree, run `python3 -B artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/c01-c02-v17-raster-caption-review/always-visible-binding-preview/serve.py` from the repo root, then open the printed localhost URL with `?rev=bd672b473ceb504ef7a75012e57d76993ac7280e`. Verify the 05:45 source and both collapsed panels. At desktop and 390×844, record native play/pause/seek, a section jump, the opened optional read-along, and transcript timestamp seeking without showing unrelated tabs or private data. Save a short H.264 MP4, verify playback and legibility, hash it, and bind the receipt to the exact route and current commit before requesting Human QA. If a supported recorder remains unavailable, retain screenshots and ask Vambah to explicitly accept that fallback; do not imply Human QA passed.

No learner media, production player binding, member data, provider state, spending, merge, production deployment, or release changed in this follow-up.
