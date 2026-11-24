# Agentified Release Calendar QA

The canonical review surface is Portfolio's existing Release Calendar at `/admin/agents/content-intelligence?section=calendar`. Agentified's ten inactive Drafts are read-only projected rows in that calendar. Opening a row's **Details** control expands the existing calendar card with approved source copy, visual previews, provenance hashes, the CTA, and blocked-action explanations. The former standalone route redirects to this calendar with the selected row focused.

The earlier standalone-route captures are retained under [`superseded-standalone/`](superseded-standalone/) for provenance. They are **not** Human QA evidence for this correction.

Reviewed code commit: `66cb672ae36907098cf58b08684412e67829832b`.

Authenticated localhost route: `http://localhost:3017/admin/agents/content-intelligence?section=calendar&calendar_item=agentified-draft%3Aagentified-workshop-2026-post-thanksgiving%3AAW-IG-CAR-01%3Av1&rev=66cb672ae36907098cf58b08684412e67829832b`.

The approved admin validation account signed into this localhost route. The rendered Calendar showed 40 rows, including the focused AW-IG-CAR-01 Draft with approved source copy, all seven preview images, source and visual hashes, CTA, release and approval dates, and blocked provider/external actions. The existing **Details** control closed and reopened the evidence in the same row. Searching `Agentified` returned 11 rows (ten projected Drafts and one pre-existing row); mobile pagination moved from page 2 to page 1 and cleared the focus banner. Neither the 1440 × 900 desktop view nor the 390 × 844 mobile view had horizontal document overflow.

Walkthroughs captured from that code commit:

| Artifact | Encoded video | SHA-256 |
| --- | --- | --- |
| Desktop | [`desktop-walkthrough.mp4`](desktop-walkthrough.mp4), H.264, 1440 × 900, 12 s, 288 frames | `0ef59278f5c2098c6986bdcd8d6aee79d691b8296aca8b1967154d1c74f58069` |
| Mobile | [`mobile-walkthrough.mp4`](mobile-walkthrough.mp4), H.264, 390 × 844, 15 s, 360 frames | `596e6fe97ced0b00e978dd4ff33763558e82f789472c1158c381f853935293e6` |

Both MP4s decoded without FFmpeg errors and their first frames were visually checked. The paired JPEGs are the source captures. The videos show sequential rendered QA states from the exact route; browser chrome, credentials, and unrelated account panels are excluded.

Focused tests: 39 passed across seven files. TypeScript checking and `git diff --check` passed. The approved visual manifest's 47 source and output hashes matched before this pagination-only correction. No campaign copy or raster bytes changed. No import, database write, provider action, spending, upload, scheduling, publishing, posting, email, outreach, or activation was performed. Human QA and merge remain pending.
