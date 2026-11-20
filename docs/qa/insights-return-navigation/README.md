# Equity Code universal navigation review

Historical shell evidence, recorded before the dashboard visual detour. Code revision: `224347a4765e6b060827518cc130f976869aff55`.

The original review used `REVIEW_REVISION=224347a47 REVIEW_BASE=http://localhost:4173 node scripts/qa/insights-return-navigation.cjs`. The local server used review-only Supabase placeholders and disabled outbound n8n hooks. `results.json` records the nine historical route/viewport checks.

| Walkthrough | Size | SHA-256 |
| --- | --- | --- |
| `desktop-1440x900.mp4` | 1440×900 | `862f866fda7e9087d6d76471bf6036fc930400a656e5d59cc5ef0889be6f8c0f` |
| `mobile-390x844.mp4` | 390×844 | `7f31ac7580fa4be597cff89b838843f8fc627f8132b722b73707beca04fab8da` |

Each walkthrough shows Portfolio's universal menu on all three dashboards, Light/Dark/System selection, one original dashboard interaction per route, and navigation to Insights and Home. The 768px run is in `results.json`. Source-integrity tests prove the three dashboard HTML files retain their approved bytes. No private account data appears in the recordings.

The shell follows Portfolio's three-way theme preference. The Compounding Graph and Home Front Ledger honor the resolved light or dark setting through their existing `data-theme` CSS. Owning the Block remains its Claude-authored dark illustration in either site theme. Its restored source hash is `d8cd0ac397adcfc1271d2f14d016d19271aa2828905510b03896b6e18067c24b`.

These MP4s and `results.json` document the earlier shell review; they are not a new Human-QA handoff for the current PR head. Run `REVIEW_NO_VIDEO=1 REVIEW_REVISION=<current-commit> node scripts/qa/insights-return-navigation.cjs` for route checks without writing new evidence. New dashboard visuals await Claude-authored source and provenance review.
