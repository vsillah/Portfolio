# Equity Code return navigation review

Code revision: `ba1658bce823754eeb0fcb79fe95793de0d9ab8f`

Run the review from this worktree with `REVIEW_BASE=http://localhost:4173 node scripts/qa/insights-return-navigation.cjs`. The local server used review-only Supabase placeholders and disabled outbound n8n hooks. `results.json` records the nine route/viewport checks.

| Walkthrough | Size | SHA-256 |
| --- | --- | --- |
| `desktop-1440x900.mp4` | 1440×900 | `1b9abd535e76bb145bd9021656a938597f80ca1c873f2d92d23bd693149f0c7e` |
| `mobile-390x844.mp4` | 390×844 | `a56f0e6571968cc0af95a49ee830a47428aa15016615c9cf6321fe6eaf74d611` |

Each video shows all three dashboards, one existing interaction per dashboard, the `All insights` return path, and the homepage return path. The 768px checks are recorded in `results.json`. No private account data appears in the recordings.
