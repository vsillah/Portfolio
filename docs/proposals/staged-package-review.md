# Staged proposal package review

This opt-in native flow prepares a proposal, reviewed agreement and pending project in the existing proposal/client dashboard routes. It collects voluntary one-time deposit and balance payments. It does not create a subscription, send mail, schedule kickoff or provision live service.

## Activation and release gates

`PROPOSAL_STAGED_PAYMENTS_ENABLED` defaults off. Deploying disabled code does not require new columns to exist for legacy reads: affected legacy handlers select existing rows and inspect the optional marker. New preparation requires migration plus a verified private bucket. Authenticated package reads and receipt reconciliation continue while initiation is off.

Migration `20260910042843_proposal_staged_package.sql` is **not applied** by this lane. Captain owns staging validation. Explicit production approval is required for storage/RLS/grants and payment activation.

- New marker columns on proposals, client_projects and client_dashboard_access; restrictive policies exclude only marked rows from anonymous/authenticated table APIs. Existing rows are unchanged.
- New service-role-only package and stage ledger tables, invoker RPCs restricted to service_role, immutable proposal-content trigger and status projection trigger.
- New private `proposal-private` bucket; fail if an existing bucket with that name is public. Restrictive storage policy prevents other broad policies exposing its objects. No change to the existing documents bucket.
- Adds `pending` to the full existing project status list. Dates become nullable only for marked packages; a check preserves required dates for all legacy projects. No dates or paid flags are fabricated.
- Serializes preparation on key, normalized email and contact. A same-key/different-content retry is rejected. An existing project requires deliberate matching, rather than automatic duplicate creation.

Release is an explicit admin action requiring review of exact agreement, expiry and bearer-access model. It atomically activates first access and cannot silently reactivate revoked access. Release is not an email send. Signatures prove possession of the scoped link, not independently verified email identity. Production must decide whether that model is acceptable; no email-verification assertion is made.

## State and payments

Native proposal statuses: draft -> released -> accepted (both documents signed) -> deposit_paid -> paid. `sent_at` is not set by release. Each document retains its own signer/time, with the frozen package content digest. The downloadable signature record includes exact agreement/proposal text and the bearer-identity limitation; unsigned original PDFs remain separate.

Deposit and balance amounts come from a validated integer-cent policy. Checkout is card-only `mode=payment`. Stable database attempt reservations bind Stripe idempotency keys; cancelled open sessions are reused, explicitly expired sessions rotate, and an uncertain attempt older than 23 hours blocks for reconciliation rather than risking a second session after provider key retention.

Webhook handling verifies paid status, amount, currency and stored stage/session. An invoker SQL function locks the package/stage and deduplicates receipts atomically. An unpaid completion event does not settle anything. Receipt reconciliation remains active when new initiation is off. No order confirmation or onboarding dispatch occurs on this staged path.

Admin submits an immutable delivery note after confirmed deposit. Client acceptance includes the exact submitted delivery version and the agreed criteria. Final checkout stays locked until acceptance. There is no automatic final charge. The dashboard distinguishes confirmed paid from remaining contract value; remaining is not automatically due.

## Verification and reproducibility

Focused Vitest commands:

```sh
npx vitest run lib/proposal-staged*.test.ts lib/contract-pdf-staged.test.ts \
'app/api/proposals/[id]/route.test.ts' 'app/api/proposals/[id]/accept/route.test.ts' \
'app/api/proposals/[id]/sign/route.test.ts' 'app/api/proposals/[id]/sign-contract/route.test.ts' \
'app/api/proposals/[id]/dashboard-link/route.test.ts' 'app/api/proposals/[id]/onboarding-plan/route.test.ts' \
'app/api/admin/proposals/[id]/generate-code/route.test.ts' 'app/api/admin/proposals/[id]/documents/route.test.ts' \
'app/api/admin/proposals/[id]/documents/[docId]/route.test.ts' \
'app/api/admin/proposals/[id]/implementation-roadmap/route.test.ts' lib/client-dashboard.test.ts
```

Local PGlite test uses a synthetic minimal schema modeled on read-only production column/constraint inspection. It executes the real migration and RPC SQL, with sequential dedupe, bucket-conflict rejection, anonymous isolation, immutable content, revoked-release protection and deposit/balance receipts. It is not hosted multi-session concurrency proof.

```sh
npm install --prefix /tmp/portfolio-staged-sql-qa --no-audit --no-fund @electric-sql/pglite
PGLITE_MODULE=/tmp/portfolio-staged-sql-qa/node_modules/@electric-sql/pglite/dist/index.js \
node scripts/qa/proposal-staged-sql.mjs supabase/migrations/20260910042843_proposal_staged_package.sql
```

Actual Next.js UI routes were exercised locally with intercepted synthetic APIs: `/admin/sales/proposals/prepare`, `/proposal/[synthetic credential]`, `/client/dashboard/[synthetic credential]`. Widths 1440, 768, 390 and 360 had no horizontal overflow. The operator preparation/retry, per-document signing, cancelled checkout/retry, confirmed deposit/locked balance, delivery acceptance/final payment and concise dashboard were recorded. These are UI mock receipts, separately supported by route and SQL tests; no live Stripe or Supabase calls occur in the walkthrough. Native PDF buffers were generated and visually rendered independently.

Privacy-safe MP4s and screenshots remain local ignored artifacts. No client terms or access credentials belong in Git. Browser evidence reports `externalRequests: []`; private routes suppress Speed Insights to avoid emitting bearer links.

## Remaining integration gates

- Run real staging migration/storage/API integration, including two-session concurrent preparation and receipt retries; inspect staging schema drift first.
- Verify both Vercel preview contexts, then exact native hosted route behavior. Local mock walkthrough is not hosted production evidence.
- Review exact real-client agreement, explicit expiry/no-expiry and access identity before package activation/release. A private ready-to-review candidate is maintained outside Git.
- Typecheck currently encounters existing duplicate properties at lib/social-comment-inbox-ui.test.ts:51-52. No new-file type errors remain. Full build is not asserted green while that baseline issue remains.
- Uncertain checkout attempts beyond provider idempotency retention and revoked-access reissue intentionally require explicit reconciliation; this release has no automatic reset/reissue button.

Rollback: disable initiation; preserve receipt handling and all signature/receipt evidence. Expire/reconcile outstanding sessions under captain authority before removal. Do not drop populated tables or revert signed packages. Only remove an unused bucket/schema after proving no dependent objects or records. No retrospective migration of legacy clients.
