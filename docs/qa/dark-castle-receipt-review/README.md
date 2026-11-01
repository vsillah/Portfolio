# Dark Castle YouTube receipt review candidates

Scope: read-only Portfolio review of Social Content record `c12378f2-36de-4bf7-8c5d-0ce754e727eb` at `sha256:4b4126fe2388687c899530cdb9ee973e744d9e0ebfd2b6378ac6b3702000342a` and persisted timestamp `2026-10-27T20:14:59.293829Z`.

The six separate packets are source, voice, framework, privacy, visual, and challenger. Packet IDs are deterministic review-candidate identities. They are not approval or prerequisite receipt IDs. Each packet records its evidence links, reviewer checks, and blockers. No decision is recorded.

## Source lineage

- The canonical production record was inspected read-only on 2026-11-01. Its `rag_context` had the exact content version, three `source_lineage` URLs, the saved description receipt, and the passed description-evidence reconciliation receipt. It had no `copy_review_evidence_receipts`, `copy_review_candidate_projection`, or `mobile_decision_review` key.
- `artifacts/human-qa/dark-castle-youtube-master-2026-10-29/receipts.json` supplies the final master, gameplay, presenter, music, script, storyboard, and external-gate evidence.
- `artifacts/human-qa/dark-castle-youtube-master-2026-10-29/thumbnail-selection-receipt-v1.json` binds the already approved Direction C asset.
- The API checks the current row and hashes the local script, storyboard, master, and thumbnail before returning packets. If the row changes, it blocks every packet. The `qa_fixture=dark_castle_receipt_packets_v1` route is limited to development and uses a public-safe projection of the inspected row without database access.

## Gate

The source materials support review preparation only. Each category still needs its own reviewer decision and persisted, exact-version prerequisite receipt. The existing atomic copy-review binding remains blocked until those receipts exist. This lane neither writes them nor calls a provider, uploads media, schedules, publishes, or changes approved assets.

## Validation

- Product revision: `f83860bf35372fa63a4cf935368af470714a8258` on `codex/shaka-dark-castle-youtube-receipt-packets`.
- Exact local QA route: `http://127.0.0.1:5328/admin/social-content/dark-castle-youtube-receipt-review?qa_fixture=dark_castle_receipt_packets_v1&rev=f83860bf35372fa63a4cf935368af470714a8258`.
- Focused tests: `vitest` packet builder, route, new page, and existing master page.
- Typecheck: `tsc --noEmit --pretty false` reports pre-existing errors outside these files; no error points to this lane.
- Browser: local fixture at desktop 1280 × 720, mobile 390 × 844, and tablet 768 × 900. Six packet controls exercised at desktop and mobile; no horizontal overflow observed.
- `walkthrough.mp4` is an 18-second, 1920 × 1080 H.264 privacy-safe still-frame walkthrough of all six exact rendered desktop and mobile review states. `desktop-01.png` through `desktop-06.png` and `mobile-01.png` through `mobile-06.png` are its source captures; `render-walkthrough.sh` reproduces it. It does not represent a live approval or production mutation.
