# Mobile Social decision reconciliation QA

This fixture-only packet verifies the protected Social Content mobile decision panel after an immutable approval advances the content row from its reviewed version to the `asset_packet` gate.

## Route

`/admin/social-content/11111111-2222-4333-8444-555555555555?step=copy&review=mobile#social-mobile-decision-receipt`

## States shown

- Desktop recorded state: all six evidence receipts remain bound to the reviewed version, the immutable decision receipt is present, and the post-decision row reports `asset_packet` as its current gate.
- Mobile blocked state: the row version is stale, the challenger receipt is still pending, no immutable decision receipt is present, and all decision controls remain disabled.

The recorder intercepts the fixture APIs, rejects decision writes, records zero provider or external feature requests, and emits H.264 MP4 evidence. It does not render or upload media, create platform drafts, schedule, publish, or send.

## Reproduce

Start the local application with outbound automation disabled, then run:

```bash
node --env-file=.env.local scripts/record-mobile-social-decision-qa.mjs
```

The final MP4 is `social-decision-version-reconciliation.mp4`.
