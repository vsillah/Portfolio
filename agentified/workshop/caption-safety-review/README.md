# Agentified caption safety review

Code commit: `1c56d0660` on `codex/agentified-caption-safety`, stacked on PR #1292 at `c67ae48dd`. Review route: `/agentified/learningplan?lesson=L07&rev=1c56d0660` on the local server for that commit.

Desktop L07-01 and L07-06 retain their source-scene caption positions, clearing the 00:14 headline and 02:37 “Block owner” tag. At 620px and below, Agentified follows the existing Accelerated pattern: the enabled native track is `hidden` for exact cue timing, and the current cue appears in a readable band below the unchanged video. The band disappears with captions off or no active cue. The mobile toggle sits in the existing caption-status line, and re-enabling while paused restores the cue immediately. L07-08 at 04:02.700 is the mobile readability example.

Desktop and 390×844 screenshots and MP4s cover captions on, off, and paused restoration at L07-01, L07-06, and L07-08. All evidence is synthetic course material and contains no account data. The six MP4s decode successfully with FFmpeg. Evidence paths and hashes are in `receipt.json`.

Run `node docs/agentified-distribution-readiness/phase-3b/record_caption_safety.cjs 1c56d0660` against `next dev -p 3121` to reproduce. The script checks all 683 source cues in L01 and L05–L16 at desktop and mobile. Each cue is activated and checked against the exact source text; timing, native track mode, desktop positioning, cue gaps, player dimensions, controls, captions off/on, paused restoration, and all mapped reading panels are checked. The two desktop position windows are bound to the source scene audit. Image recognition of every video frame is outside this check; the visual evidence covers the three reported scenes.

Validation: 39 focused Hero and Workshop tests passed, including mobile cue restoration and the desktop L07 ranges. Full `tsc --noEmit` reports 38 existing errors outside the changed Agentified files. No provider, speech generation, spending, merge, deployment, publication, or release was performed.
