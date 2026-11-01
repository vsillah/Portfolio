# Dark Castle approved media binding review

Source revision of the captured interface: `8aec53a2` in `codex/dark-castle-operator-binding`.

Exact local route: `http://127.0.0.1:5327/admin/social-content/dark-castle-youtube-master-review?qa_fixture=dark_castle_binding_readiness_v1&rev=8aec53a2`

The local fixture is read-only. It verifies the shipped master and approved Direction C thumbnail bytes against their review receipts, then shows the production-observed prerequisite blocker without connecting the fixture to production. The approved Direction C remains distinct when B is selected for comparison; the canonical binding action is disabled while the six persisted copy-review evidence receipts are absent. The gate sequence is copy review, visual review, asset packet, privacy, and platform submission. No decision or external execution is shown or performed.

- `desktop.png`: reviewed master and context.
- `desktop-preview-b.png`: comparison-only B selection with C still approved.
- `desktop-operator.png`: blocked binding and disabled action at 1280-pixel viewport.
- `mobile-approved-c.png` and `mobile-operator.png`: approved media and blocked action at 390-pixel viewport.
- `tablet-operator.png`: mid-width layout at 768-pixel viewport.
- `desktop-walkthrough.mp4` and `mobile-walkthrough.mp4`: privacy-safe screen-capture sequences encoded from the exact browser screenshots. These show the states captured during the operator walkthrough; they contain no live production row values beyond the already-public approved artifact identifiers.

Production was inspected read-only. The canonical record has the description and evidence reconciliation receipts, but lacks bound master and thumbnail media, the six copy-review evidence receipts, the copy candidate projection, and the Decision Queue packet. No migration was applied and no production row was changed. Captain integration must review the migration, validate staging, and decide how genuine six-receipt evidence will be sourced and approved before enabling the operator action on production.
