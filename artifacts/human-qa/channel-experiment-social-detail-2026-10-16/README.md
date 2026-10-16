# Authorized channel campaign review Human QA

This packet reviews the exact six authorized Social Content identities. The application build is bound to commit `b7c517ce776b007e18c057f3e1cde5172b93b922`.

## Exact localhost routes and variants

- LinkedIn `licenses-li-b` — `http://127.0.0.1:3107/admin/social-content/26a4a7c9-2325-4ef7-a2ee-a83a366d4146?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=b7c517ce776b007e18c057f3e1cde5172b93b922`
- YouTube `licenses-yt-a` — `http://127.0.0.1:3107/admin/social-content/1f3cec8c-afcb-4551-90fa-b8d4f9dabe2f?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=b7c517ce776b007e18c057f3e1cde5172b93b922`
- LinkedIn `pm-os-li-b` — `http://127.0.0.1:3107/admin/social-content/6b499ed2-edcb-4782-98c8-d59be644df50?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=b7c517ce776b007e18c057f3e1cde5172b93b922`
- YouTube `pm-os-yt-b` — `http://127.0.0.1:3107/admin/social-content/e06ab168-56aa-45f5-9672-619215df3ce7?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=b7c517ce776b007e18c057f3e1cde5172b93b922`
- LinkedIn `harness-li-b` — `http://127.0.0.1:3107/admin/social-content/03f9e0ed-3fee-4d5b-815c-602b6e0e917b?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=b7c517ce776b007e18c057f3e1cde5172b93b922`
- YouTube `harness-yt-b` — `http://127.0.0.1:3107/admin/social-content/2d96e662-5e7e-4761-8a87-85128e20a559?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=b7c517ce776b007e18c057f3e1cde5172b93b922`

## Review contract

- The three LinkedIn control records retain the ordinary LinkedIn copy-review workflow, copy guidance, and LinkedIn preview. They do not render the specialized YouTube review.
- The three YouTube records show channel-native title, description, opening hook, episode outline, thumbnail brief, evidence lineage, product-proof requirements, and the explicit `Unscored` state. They do not render LinkedIn guidance, a generic copy-approval gate, or draft-mutation actions.
- Every route is backed by a deterministic, privacy-safe fixture keyed to the exact UUID, so the review requires no production Social Content read or write.

## Evidence

- `channel-experiment-social-detail-walkthrough.mp4` contains the desktop and narrow-width walkthrough across all six identities.
- The 24 PNG files cover every route at `1440x900` and `390x844`, with an initial route view and a channel-specific review view.
- `qa-receipt.json` records the UUID/variant/channel mapping, exact routes, viewport coverage, assertions, MP4 probe and SHA-256, and network/side-effect receipts.

## Validation

- Focused Vitest suite — 137 tests passed across six files.
- Scoped `next lint` — no warnings or errors.
- `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed; only existing unrelated image and browser-data warnings were reported.
- QA recorder — 12 route/viewport reviews passed with zero unexpected external requests.

No production Social Content row was read or mutated. No provider call, render, upload, platform draft, schedule, publish, or external send occurred.
