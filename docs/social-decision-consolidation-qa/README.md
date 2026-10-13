# Social Content decision consolidation QA

Privacy-safe, synthetic evidence for the canonical Social Content decision path.

## Reviewed path

1. Open the filtered Decision Queue item at `/admin/agents/coordination?proposal=work-mobile-qa`.
2. Use **Review Social Content gate** to open the exact version-bound Social Content stage.
3. Confirm the receipt-complete recorded state or the fail-closed missing/stale evidence state.
4. Open the linked Agent Run and confirm that generic **Approve** and **Decline** controls are absent; only **Open canonical Social Content decision** remains.

## Responsive evidence

- `desktop-canonical-receipt.png` — 1280 × 900 recorded receipt state.
- `tablet-canonical-receipt.png` — 768 × 1024 recorded receipt state.
- `mobile-canonical-blocked.png` — 390 × 844 fail-closed evidence state.
- `social-decision-consolidation.mp4` — 31.76-second H.264 walkthrough combining desktop, tablet, and mobile passes.

The recorder observed zero provider or external feature requests. It used synthetic content, synthetic receipts, and intercepted local admin reads. It did not apply migrations, mutate shared content, create provider rows, upload, schedule, publish, send, change credentials, or call external services.

## Deployment order

This PR is the **expand + deploy** portion of an expand/deploy/contract sequence:

1. Apply `20261013150000_social_content_canonical_decision_commands.sql` to add `record_social_content_stage_decision` while keeping the deployed `record_social_content_decision` RPC and its existing `service_role` grant intact.
2. Deploy the application, which calls only `record_social_content_stage_decision`, then verify the canonical decision path and immutable receipt behavior.
3. Create a separate contract migration to revoke the legacy RPC only after post-deploy verification proves no supported runtime still calls it.

The contract migration is intentionally outside this PR. Applying this migration before the application deploy therefore preserves the current runtime; deploying the application after the migration enables the new canonical command without a missing-RPC window.
