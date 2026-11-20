# Equity Code shell and Claude-authored Owning the Block review

Code revision: `4d6153f87aaddfae88d3e056dc0d0feee8cc6eeb`. Exact localhost route: `http://localhost:4173/insights/owning-the-block?rev=4d6153f87`.

The corrected Owning the Block HTML was imported verbatim from Claude's returned artifact. Its SHA-256 is `f511f78e35d60bbc6181d01e76aa11dcccccf85026d564acb591003d1dcc4e96`. The protected original, exact Claude brief, their hashes, and the immutable source comparison are recorded in `docs/insights/equity-code-source-register.md` and its source-integrity test.

The review server used placeholder Supabase values and disabled outbound n8n hooks. Run `REVIEW_REVISION=4d6153f87 REVIEW_BASE=http://localhost:4173 node scripts/qa/insights-return-navigation.cjs` from this worktree. `results.json` records 19 route, viewport, theme, geometry, and interaction checks. Eight focused tests passed. The optimized Next build passed with an 8 GB Node heap after the repository's knowledge generation step. Repo-wide standalone `tsc --noEmit` still reports existing errors in unrelated unchanged files; the captain approved treating those as a baseline exception for this integration.

| Fresh walkthrough | Resolution | Duration | SHA-256 |
| --- | --- | --- | --- |
| `desktop-1440x900.mp4` | 1440×900 | 37.56 s | `17605e0649846dff306fb982ac9b3a3c20c91e6d3b615fd9049d3771a521e374` |
| `mobile-390x844.mp4` | 390×844 | 38.92 s | `a8cb1bf556b5b95bd8ed7e91f2c93f2ec68bece34c83c7774e16ebe18876b877` |

Both H.264 MP4s were checked at native resolution. They show the Portfolio menu and theme changes, Claude's Boston-block building silhouettes, the separate water and sewer structures, street covers and access shafts, and representative building and end-to-end build interactions in Dark and Light. The mobile video pans the existing contained figure to show both sides. System mode resolves from the shell; a dark OS preference is checked in `results.json`. No private account data appears in the recordings.

The dashboard source is intentionally unchanged by the review script. The MP4s are review evidence for draft PR #1285, not deployment proof. No live workflow or customer-data smoke was run.
