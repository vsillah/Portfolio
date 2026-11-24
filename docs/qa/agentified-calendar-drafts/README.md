# Agentified Release Calendar QA

The canonical review surface is Portfolio's existing Release Calendar at `/admin/agents/content-intelligence?section=calendar`. Agentified's ten inactive Drafts are read-only projected rows in that calendar. Opening a row's **Details** control expands the existing calendar card with approved source copy, visual previews, provenance hashes, the CTA, and blocked-action explanations. The former standalone route redirects to this calendar with the selected row focused.

The earlier standalone-route captures are retained under [`superseded-standalone/`](superseded-standalone/) for provenance. They are **not** Human QA evidence for this correction.

Reviewed code commit: `8f991f635e6b23735072df3f19c907e663bbb446`.

Focused tests: 38 passed. TypeScript checking and `git diff --check` passed. The approved visual manifest's 47 source and output hashes matched. No campaign copy or raster bytes changed. No import, database write, provider action, spending, upload, scheduling, publishing, posting, email, outreach, or activation was performed.

Exact-route desktop and 390 × 844 MP4s: **pending authenticated localhost capture**. The local Release Calendar redirects to `/auth/login`; Google OAuth is disabled in the local Supabase instance, and the established 1Password recovery path is locked behind Touch ID. Human QA remains pending until the browser can load the exact latest calendar route and the walkthroughs are captured and decoded.
