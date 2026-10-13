# Mobile Social decision reconciliation QA

This fixture-only packet verifies the protected Social Content mobile decision panel after an immutable approval advances the content row from its reviewed version to the `asset_packet` gate.

## Route

`https://portfolio-git-codex-social-decision-ve-29169a-vsillahs-projects.vercel.app/admin/social-content/11111111-2222-4333-8444-555555555555?step=copy&review=mobile#social-mobile-decision-receipt`

The checked-in evidence was captured from the protected PR preview after both Portfolio Vercel contexts passed. The recorder used the short-lived development OIDC header supplied by the linked Vercel project; no bypass value is stored in this package.

## States shown

- Desktop recorded state: all six evidence receipts remain bound to the reviewed version, the immutable decision receipt is present, and the post-decision row reports `asset_packet` as its current gate.
- Mobile blocked state: the row version is stale, the challenger receipt is still pending, metadata claims a completed decision, but no server-verified immutable receipt row is present; all decision controls remain disabled.

The recorder intercepts the fixture APIs, rejects decision writes, records zero provider or external feature requests, and emits H.264 MP4 evidence. It does not render or upload media, create platform drafts, schedule, publish, or send.

## Reproduce

Start the local application with outbound automation disabled, then run:

```bash
node --env-file=.env.local scripts/record-mobile-social-decision-qa.mjs
```

The final MP4 is `social-decision-version-reconciliation.mp4`.
