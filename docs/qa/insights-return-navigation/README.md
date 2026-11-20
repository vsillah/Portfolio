# Equity Code universal navigation review

Code revision: `ab6ba6f0925b8e2ac47da5e5af5d3c15ab4b6a5a`

Run the review from this worktree with `REVIEW_REVISION=ab6ba6f09 REVIEW_BASE=http://localhost:4173 node scripts/qa/insights-return-navigation.cjs`. The local server used review-only Supabase placeholders and disabled outbound n8n hooks. `results.json` records the nine route/viewport checks.

| Walkthrough | Size | SHA-256 |
| --- | --- | --- |
| `desktop-1440x900.mp4` | 1440×900 | `c5f0ccf330cb753b17c9cfe67470216212241ebb4e8e8bd50c5145256ff25f6d` |
| `mobile-390x844.mp4` | 390×844 | `e17630a012d1ac0aff9530330551a3e3fee79b53d3e77a47d5f13266325fc42f` |

Each walkthrough shows Portfolio's universal menu on all three dashboards, Light/Dark/System selection, one original dashboard interaction per route, and navigation to Insights and Home. The 768px run is in `results.json`. Source-integrity tests prove the three dashboard HTML files retain their approved bytes. No private account data appears in the recordings.

The shell follows Portfolio's three-way theme preference. The Compounding Graph and Home Front Ledger honor the resolved light or dark setting through their existing `data-theme` CSS. Owning the Block remains its authored dark illustration in either site theme.
