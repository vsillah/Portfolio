# Accelerated four-record activation review

This packet reviews only the existing November 18–20, 2026 Accelerated campaign records. The activation code is disabled by default and performs no provider generation, asset upload, copy edit, outreach, credential or billing change. The two walkthroughs use read-only projections of the exact persisted production rows and block every mutation.

| Channel | Social Content ID | Calendar ID | Existing UTC time |
| --- | --- | --- | --- |
| LinkedIn | `20d09867-24ce-4849-b03d-f877d7114d6a` | `796d6523-d600-45cf-96bb-541058af5817` | Nov 18 15:00 |
| X | `d0046271-92ba-4c7f-a009-197b44562f48` | `af8ed285-69f4-4036-8201-1aa66827bb48` | Nov 19 17:00 |
| LinkedIn | `9499ecbf-0349-472a-9b12-b6d987d1939d` | `07fa29e5-40dc-4b86-9871-a49be6349613` | Nov 20 15:00 |
| Instagram | `34471e82-2cb4-4e06-b3ec-d48f9739bb0f` | `fc23411f-f756-4ed8-8e5b-40ff26cf144e` | Nov 20 23:00 |

## Current production blockers

Read-only verification on Nov 16 found the reviewed copy hashes, campaign identity, calendar bindings, source/JIT/privacy/originality/CTA/visual receipts, and connected AmaduTown account identities intact. All four channels lack a verified $0, no-spend execution setting. The three visual records have approved raster bytes in the repository but no platform-usable HTTPS URLs attached to the Social Content rows. The route requires byte-for-byte SHA-256 equality with those approved files; it cannot upload or substitute assets. The X item is intentionally text-only.

## Captain execution contract

1. Review the draft PR, local video, focused tests, and current production rows. Keep the production activation flag off through review and deployment.
2. Resolve only the concrete blockers through separately authorized work. Existing platform-usable AmaduTown HTTPS asset URLs must serve the exact approved PNG bytes. A verified $0 path must be represented in each relevant `social_content_config.settings` by `campaign_zero_fee_verified: true` and `campaign_zero_fee_cap_usd: 0`; the setting is evidence of an independently verified provider fee path, not proof by itself. Do not set it from an estimate or change billing or credentials under this PR.
3. Recheck the four IDs, calendar times, copy and asset SHA-256 hashes, account identity, JIT/source/privacy/originality/CTA/visual receipts, empty publish rows, and future time. The GET activation endpoint reports blockers without changing state.
4. Only after the separate release authorization and the above checks pass, set `ACCELERATED_FOUR_RECORD_ACTIVATION_ENABLED=true` in the approved deployment context and use each record's exact Social Content activation control. POST requires the campaign scope, campaign ID, content ID, calendar ID, channel, UTC time, frozen copy hash, and current row version. A successful POST creates one pending publish receipt and CAS-claims the existing schedule. Do not retry an uncertain or partially saved result; reconcile it first.
5. Verify the four scheduled rows, one pending publish receipt per row, unchanged copy and calendar rows, and the scheduled-publish cron's due-time behavior. Any blocked or uncertain provider outcome requires the existing recovery and reconciliation path. No other record is in scope.

The deployment flag is also checked at publish time. Turning it off halts this campaign's automatic release. Calendar cancellation remains available through the existing recovery path; rescheduling to a different time is blocked.

## Reproduce the local walkthrough

With the existing gitignored localhost admin storage state and read-only production QA connection available:

```bash
QA_BASE_URL=http://localhost:4272 ./node_modules/.bin/tsx scripts/qa/record-accelerated-campaign-activation.mjs
```

The recorder expects a localhost server from this branch, intercepts the exact four Social Content GET responses and activation GETs with current read-only evidence, rejects non-GET actions, and writes desktop and mobile MP4s plus a receipt. It must observe zero product writes and disabled schedule controls.
