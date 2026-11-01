# LinkedIn handoff review fixture

Commit: `0f0f1ab4` (`codex/linkedin-final-review-readiness`)

Local route: `http://localhost:3100/admin/agents/coordination/qa-linkedin-handoff?rev=0f0f1ab4`

This development-only route renders the Decision Queue handoff component with synthetic copy, receipt IDs, visual, and lead-magnet binding. The five JPEGs capture desktop packet, expanded receipt lineage, enabled revision state, mobile packet, and mobile controls. `walkthrough.mp4` presents those states in that order. It is a screenshot-sequence walkthrough, not a live decision recording. No decision button was submitted and no production record was read or changed.

Visual checks: 390, 768, and 1280 pixel viewports; no horizontal overflow. The 768 pixel check was visual only and has no separate screenshot.

Video verification: H.264, 1280×960, 24 fps, 360 frames, 15 seconds; a decoded mobile frame was inspected.

Authenticated Human QA remains pending. The local authenticated route did not resolve in the integrated browser. The captain must load the exact PR revision behind the normal admin session, apply and validate the migration in staging, and capture an authenticated workflow walkthrough before asking Vambah to approve the client-facing behavior.
