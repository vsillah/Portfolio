# Equity Code universal navigation review

Code revision: `224347a4765e6b060827518cc130f976869aff55`

Run the review from this worktree with `REVIEW_REVISION=224347a47 REVIEW_BASE=http://localhost:4173 node scripts/qa/insights-return-navigation.cjs`. The local server used review-only Supabase placeholders and disabled outbound n8n hooks. `results.json` records the nine route/viewport checks.

| Walkthrough | Size | SHA-256 |
| --- | --- | --- |
| `desktop-1440x900.mp4` | 1440×900 | `862f866fda7e9087d6d76471bf6036fc930400a656e5d59cc5ef0889be6f8c0f` |
| `mobile-390x844.mp4` | 390×844 | `7f31ac7580fa4be597cff89b838843f8fc627f8132b722b73707beca04fab8da` |

Each walkthrough shows Portfolio's universal menu on all three dashboards, Light/Dark/System selection, one original dashboard interaction per route, and navigation to Insights and Home. The 768px run is in `results.json`. Source-integrity tests prove the three dashboard HTML files retain their approved bytes. No private account data appears in the recordings.

The shell follows Portfolio's three-way theme preference. The Compounding Graph and Home Front Ledger honor the resolved light or dark setting through their existing `data-theme` CSS. Owning the Block remains its authored dark illustration in either site theme.
