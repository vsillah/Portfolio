# Equity Code universal navigation and Owning the Block theme review

Code revision: `627c637ce` (`fix: make block utilities legible underground`)

Run from this worktree with `REVIEW_REVISION=627c637ce REVIEW_BASE=http://localhost:4173 node scripts/qa/insights-return-navigation.cjs`. The exact review route was `http://localhost:4173/insights/owning-the-block?rev=627c637ce`. The local server used review-only Supabase placeholders and disabled outbound n8n hooks. `results.json` records 19 route, viewport, and theme checks.

| Walkthrough | Size | SHA-256 |
| --- | --- | --- |
| `desktop-1440x900.mp4` | 1440×900 | `8b9e3680c5d06186ef3657cf9eb50efa8b3ee08b7016ad465da9134d4464b4c0` |
| `mobile-390x844.mp4` | 390×844 | `ee8d311b1df4658dd04ebcef6edcb699537bbb7cd8afbfe648d295b595c0f8a4` |

Both walkthroughs show Portfolio's universal menu, Light/Dark/System selection on Owning the Block, and the original dashboard interactions. Each pauses on the lower half in Dark and Light; the mobile walkthrough pans within the existing horizontally scrollable figure to show both access shafts. The encoded H.264 MP4s were inspected at native playback sizes. The 768px run and System with a dark OS preference are recorded in `results.json`.

The light treatment applies to the full Owning the Block canvas, diagram plates, node cards, labels, connectors, controls, and narration. The skyline uses a separate non-interactive Boston streetfront silhouette, with varied rooflines on the existing building nodes; no project is assigned to a real landmark. A teal pipe with elbows, joints, and branches runs between the underground node rows. A separate wide, segmented masonry-colored sewer channel sits below the lower nodes. Two street manholes connect through vertical access shafts to the sewer level. These are visual metaphors in a non-interactive background group behind every research connector, node, label, and focus target; they do not terminate at data nodes. The route verifier checks layer order, pointer events, distinct computed pipe/sewer/connector signatures, covers, shafts, label clearance, and original interactions. The source-integrity test strips only the bounded theme and visual geometry additions and then matches the approved original file hash. The other two dashboard HTML hashes remain unchanged.

No private account data appears in the recordings. The review server's placeholder Supabase values mean unrelated homepage APIs may fail during navigation, but no customer-data flow is exercised.
