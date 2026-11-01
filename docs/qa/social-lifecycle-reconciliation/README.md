# Social Lifecycle Projection Reconciliation QA

Implementation commit: `123dcc5ce8366739362ad5fb4c491889154c0fac`

Local review URL: `http://localhost:3107/admin/social-content/563d3ee1-e5b9-41bb-89f3-9273ea017272?qa_fixture=social_lifecycle_reconciliation_v1&step=submit&review=mobile&rev=123dcc5ce8366739362ad5fb4c491889154c0fac`

This development-only route projects the reproduced immutable receipt shape with synthetic copy. It is read-only and does not connect to the production record, the pending publish row, or LinkedIn. The production record and pending publish row were inspected with read-only SQL; no row was changed.

The header and stepper show Context, Copy, Visuals, Draft, and Submit approved. Status remains pending. The submission panel shows final gate approval as complete, while provider execution stays blocked in the local fixture because it has no connected provider configuration. This distinction preserves the approved receipt without implying a provider action occurred.

Evidence at 1440 × 900 and 390 × 844:

- `desktop-header.png`: current gate and all six step states.
- `desktop-panel.png`: pending publish row and final gate versus execution readiness.
- `mobile-header.png`, `mobile-details.png`, `mobile-stepper.png`, `mobile-panel.png`: narrow layout and expanded next-action details.
- `walkthrough.mp4`: 18-second H.264 sequence of those exact browser captures. The sequence includes the expanded details state. `ffprobe` confirmed a 1440 × 900, 434-frame playable file.

Validation: `vitest run lib/social-lifecycle-receipt-reconciliation.test.ts lib/social-content-lifecycle.test.ts lib/social-platform-orchestration.test.ts` passed (50 tests). The larger page suite passed 105 of 107 tests; the two failures are existing Jev video/calendar fixture expectations. Repository type checking still reports existing errors outside the changed files, including missing generated knowledge and PGlite modules. Browser inspection found no horizontal overflow at 390 px.
