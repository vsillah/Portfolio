# Agentified L07 caption safety review

Code and test commit: `49a2e1a5b` on `codex/agentified-caption-safety`, stacked on PR #1292 at `c67ae48dd`. The exact review route is `/agentified/learningplan?lesson=L07&rev=49a2e1a5b` on the local server for that commit.

At 00:14 in L07-01, the native cue previously covered “A polished draft can hide a bad claim.” At 02:37 in L07-06, the native cue covered the “Block owner” tag. The desktop cues now use scene-specific positions that clear those labels; mobile cues remain in their original native positions. Desktop and 390×844 screenshots show captions on, captions off, and restored while paused for both scenes. Four MP4s show the same exact route and state changes. All evidence is synthetic course material and contains no account data.

Run `node docs/agentified-distribution-readiness/phase-3b/record_caption_safety.cjs 49a2e1a5b` against `next dev -p 3121` to reproduce. The script checks all 683 source cues in L01 and L05–L16 at desktop and mobile: text, timings, cue placement, native controls, player aspect ratio, captions off/on, and paused restoration. Its machine-readable results and evidence hashes are in `receipt.json`. It verifies that only desktop L07-01 and L07-06 cues change placement, with ranges bound to the source scene audit. It does not perform image recognition of every cue frame; the visual evidence focuses on the two reported collisions.

Validation: focused hero tests passed (11 tests, including both cue ranges, unaffected cues, desktop/mobile restoration at the 620/621 breakpoint, and PR #1292's L07-07 reading aid). Full `tsc --noEmit` remains blocked by existing errors outside the changed files. No provider, speech generation, spending, merge, deployment, publication, or release was performed.
