# Native proposal milestone payments

This patch stacks on the native document-role branch. It extends the existing installment plan/payment records with a one-time milestone kind; subscription behavior remains the default for legacy proposals. Configure two equal payments on an unissued draft in the existing Proposal & documents drawer. Both reviewed documents are required before issuance, and both signatures/current document identity are required before checkout.

The first payment is half the agreed total, with no fee or recurring subscription. Only verified paid Checkout evidence updates receipts and creates/reuses the existing client project/dashboard. The project records the actual received amount and has no inferred kickoff/end date. Full proposal paid status is reserved for the second receipt. Delivery submission is an admin action; the client can accept the submitted revision or request corrections with optional feedback. Final checkout stays locked until acceptance. Generic onboarding milestones have no billing authority.

## Release order and access

Apply `20260911011959_native_proposal_milestones.sql` only after the document consistency migration. This changes billing and access controls and relaxes required project dates; hosted application needs the appropriate review/approval. No hosted migration or provider activation is part of this patch.

Milestone proposals require a high-entropy issued code. Their UUID-only read/sign/dashboard-link/mark-viewed paths fail closed. Restrictive RLS excludes milestone proposals, their document rows, plan/payment rows and dashboard bearer records from direct anon/authenticated Data API access. Server endpoints validate the proposal or existing dashboard bearer. Legacy broad proposal/token policies remain for non-milestone records; this is not a general authorization remediation. A bearer link can be used by anyone holding it; identity verification beyond possession, forwarding, analytics/referrer exposure and existing unrelated dashboard routes require release review. No claim of safe live customer issuance follows from the local UI checks alone.

## Payment consistency

Reservations serialize on the proposal row and persist the Stripe idempotency key. Two simultaneous requests share a payment/attempt. Ambiguous creation after 23 hours without a recorded session requires reconciliation rather than re-creating a charge. Every unpaid initial reservation rechecks proposal expiry. Cached sessions are retrieved by exact stored ID and verified before reuse; expired evidence rotates the attempt and prompts a retry. New sessions use a stable expiry bounded by the initial proposal validity and Stripe's minimum checkout window. A paid engagement can still reach its final milestone after proposal expiry. Verified expiration rotates the attempt; a cancelled return does not imply payment. Paid evidence must match proposal, payment, attempt, document revision, session, amount, currency and intent. Duplicate settlement is idempotent. Milestone events and malformed legacy events naming milestone proposals cannot enter the legacy fulfillment branch. No legacy confirmation, campaign, guarantee, onboarding or provisioning dispatch runs for milestone settlement.

Provider refunds/disputes and unresolved checkout creation are manual reconciliation gates; no automatic refund or credential/provider operation is added. The plan/payment records are the receipt source; no second billing ledger or standalone dashboard is introduced. The existing legacy account summary is omitted for milestone projects because it assumes full payment; the milestone panel presents the actual receipts.

## Local validation

- `node scripts/qa/proposal-milestones-sql.cjs`: actual migrations against a dedicated network-disabled PostgreSQL synthetic schema fixture, including signatures, amounts, stale revision, rejection/correction, expiration, replay, private RLS and concurrent reservations/settlements. The fixture is deliberately isolated; this is not a hosted schema smoke or full migration-history replay.
- `npx vitest run app/api/proposals lib/sign-proposal-document.test.ts lib/proposal-milestones.test.ts lib/proposal-milestone-access-routes.test.ts lib/client-dashboard.test.ts lib/client-dashboard-document-roles.test.ts app/api/installments/create/route.test.ts`: focused native and legacy regression.
- `node scripts/qa/proposal-milestones-ui.cjs`: localhost native proposal/dashboard at 360/390/768/1440, all API/provider/delivery evidence intercepted and synthetic. MP4/screenshot receipts stay local-private. Admin drawer configuration/submission is also exercised using the existing local admin fixture.
- `QA_LOCAL_SQL=true npx vitest run scripts/qa/proposal-milestones.integration.test.ts`: actual native code-read/sign/accept/dashboard-action handlers through a SQL adapter to the isolated database, including final lock/acceptance/settlement. Only Stripe creation and event evidence are mocked; this does not verify a real Stripe signature or hosted PostgREST wiring.
- Changed-file ESLint and `git diff --check` pass. Whole-tree typecheck remains blocked by pre-existing duplicate keys in `lib/social-comment-inbox-ui.test.ts` and old ignored local rendering scripts. No full build or live workflow/customer-data smoke is claimed.

Real-provider verification must cover exact session retrieval, delayed/lost expiry webhook recovery, processing/paid reconciliation, idempotency retention and signed webhook delivery before activation.

Both Vercel contexts for this new stack and production-equivalent acceptance remain captain release gates. No migration, deploy, charge, issuance or customer action was run by this implementation lane.

References: [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests), [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
