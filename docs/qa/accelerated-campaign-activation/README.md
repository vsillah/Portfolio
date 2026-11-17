# Accelerated three-record activation review

This packet reviews the three approved visual records for November 18–20, 2026. The November 19 X record remains Draft and read-only because X Post creation has a disclosed fee. The activation code is disabled by default and performs no provider generation, asset upload, copy edit, outreach, credential or billing change. The two walkthroughs use read-only projections of the exact persisted production rows and block every mutation.

| Channel | Social Content ID | Calendar ID | Existing UTC time |
| --- | --- | --- | --- |
| LinkedIn | `20d09867-24ce-4849-b03d-f877d7114d6a` | `796d6523-d600-45cf-96bb-541058af5817` | Nov 18 15:00 |
| LinkedIn | `9499ecbf-0349-472a-9b12-b6d987d1939d` | `07fa29e5-40dc-4b86-9871-a49be6349613` | Nov 20 15:00 |
| Instagram | `34471e82-2cb4-4e06-b3ec-d48f9739bb0f` | `fc23411f-f756-4ed8-8e5b-40ff26cf144e` | Nov 20 23:00 |

## Current production blockers

The three approved visual records have frozen copy, calendar, source, JIT, privacy, originality, CTA, and visual receipts. Their approved PNG bytes are copied byte for byte to `/campaigns/accelerated/2026-11/slide-01.png` through `slide-08.png`. The single-image LinkedIn record uses slide 01; both carousel records use all eight in order. The route verifies the public HTTPS responses against the frozen SHA-256 hashes before a schedule can be claimed, then writes the exact URL fields and schedule in one compare-and-swap queue update. The deployment must serve those paths before activation. A verified $0/no-spend execution path is still missing, and the activation flag remains off. X is outside all activation and release allowlists and remains protected from ordinary scheduling routes.

## Captain execution contract

1. Review the draft PR, local video, focused tests, and current production rows. Keep the production activation flag off through review and deployment.
2. Resolve only the concrete blockers through separately authorized work. The deployed AmaduTown HTTPS asset URLs must serve the exact approved PNG bytes with no redirect or substitution. A verified $0 path must be represented in each relevant `social_content_config.settings` by `campaign_zero_fee_verified: true` and `campaign_zero_fee_cap_usd: 0`; the setting is evidence of an independently verified provider fee path, not proof by itself. Do not set it from an estimate or change billing or credentials under this PR.
3. Recheck the three eligible IDs and the excluded X lock, calendar times, copy and asset SHA-256 hashes, account identity, JIT/source/privacy/originality/CTA/visual receipts, empty publish rows, and future time. The GET activation endpoint reports blockers without changing state.
4. Only after the separate release authorization and the above checks pass, set `ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED=true` in the approved deployment context and use each record's exact Social Content activation control. POST requires the campaign scope, campaign ID, content ID, calendar ID, channel, UTC time, frozen copy hash, and current row version. A successful POST creates one pending publish receipt and CAS-claims the existing schedule together with the exact image or ordered carousel URLs. Do not retry an uncertain or partially saved result; reconcile it first.
5. Verify only the three eligible scheduled rows, one pending publish receipt per eligible row, the X record still Draft, unchanged copy and calendar rows, and the scheduled-publish cron's due-time behavior. Any blocked or uncertain provider outcome requires the existing recovery and reconciliation path. No other record is in scope.

The deployment flag is also checked at publish time. Turning it off halts this campaign's automatic release. Calendar cancellation remains available through the existing recovery path; rescheduling to a different time is blocked.

## Reproduce the local walkthrough

With a localhost server from this branch, a read-only production QA connection, and the existing `ADMIN_E2E_EMAIL` and `ADMIN_E2E_PASSWORD` environment variables available:

```bash
QA_BASE_URL=http://localhost:4272 ./node_modules/.bin/tsx scripts/qa/record-accelerated-campaign-activation.mjs
```

The recorder signs in through a separate, unrecorded browser context. It intercepts the four Social Content GET responses, including the read-only X review, and the three eligible activation GETs. It verifies local public-copy bytes for the projection; hosted HTTPS bytes still require post-deployment verification. It rejects non-GET actions and writes desktop and mobile MP4s plus a receipt. It must observe zero product writes and disabled schedule controls. Credentials are never included in the recording or receipt.
