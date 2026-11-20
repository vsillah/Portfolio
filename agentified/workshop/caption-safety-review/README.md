# Agentified L07 caption safety review

Code commit: `0581ba274` on `codex/agentified-caption-safety`, stacked on PR #1292. The exact review route is `/agentified/learningplan?lesson=L07&rev=0581ba274` on the local server for that commit.

At 00:14 in L07-01, the native cue previously covered “A polished draft can hide a bad claim.” The desktop cue is now at the top of the video; the mobile cue remains in its original native position. The desktop and 390×844 screenshots show captions on, captions off, and restored while paused. The two MP4s show the same route and state changes. All evidence is synthetic course material and contains no account data.

Run `node docs/agentified-distribution-readiness/phase-3b/record_caption_safety.cjs 0581ba274` against `next dev -p 3121` to reproduce. The script checks all 683 source cues in L01 and L05–L16 at desktop and mobile: text, timings, cue placement, native controls, player aspect ratio, captions off/on, and paused restoration. Its machine-readable results and evidence hashes are in `receipt.json`. It also verifies that only desktop L07-01 cues change placement. It does not perform image recognition of every cue frame; the visual evidence focuses on the reported collision.

Validation: focused hero tests passed (9 tests). Full `tsc --noEmit` remains blocked by existing errors outside the changed files. No provider, speech generation, spending, merge, deployment, publication, or release was performed.
