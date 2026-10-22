# Official signal native review QA

The walkthrough uses the local Content Intelligence research route, an approved admin validation session, and synthetic API responses. It does not approve a packet or write evidence. The real API routes remain protected by admin auth and server-side receipt validation.

- Code commit recorded: `17694c6e`
- Local route: `/admin/agents/content-intelligence?section=research&packet=11111111-1111-1111-1111-111111111111&rev=17694c6e`
- Viewports: 1440 × 900 desktop, 390 × 844 mobile
- Video: `official-native-review.mp4` (plain-language blocked state, collapsed and expanded technical evidence, qualifying evidence, review fields, enabled approval; no submission)
- Screenshots: `desktop-blocked.png`, `desktop-observations.png`, `desktop-ready.png`, `mobile-summary.png`, `mobile-ready.png`
- Capture script: `scripts/qa/record-official-signal-native-review.mjs`

This is synthetic local UI evidence. It does not demonstrate an approved live observation cohort or production readiness. Human QA remains pending until the exact latest localhost commit is visible in the in-app browser under an authenticated session.
