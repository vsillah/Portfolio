# Invoice-managed native milestones

Stacked after native proposal documents (#967) and milestone payments (#968). Existing proposals retain `milestone_settlement='stripe_checkout'`. Select `manual_invoice` only on an unissued draft using the existing Proposal & documents milestone panel. No existing proposal is converted by this migration.

The native signature flow still requires both reviewed documents. Invoice mode displays two equal amounts and a separate-invoice next step. Signing does not create a payment plan, project, dashboard link or kickoff date. URL payment flags cannot establish receipt. All native checkout attempts and checkout webhook settlements for this mode fail closed; legacy full/subscription proposals retain their existing behavior.

An admin may record a verified payment in the same panel using the exact half amount and an external receipt reference. This is a bookkeeping action, not invoice creation, sending, Stripe confirmation or a charge. Only after the initial receipt is recorded does the existing ledger create/reuse a project and dashboard. No kickoff dates are fabricated. Final receipt requires client acceptance of the current delivered revision in the existing dashboard. Receipt references are unique, the authenticated admin ID and recording time are preserved, exact retries do not double-count, and conflicting retries fail. Receipt-reference metadata is not returned to customers.

## Migration and release gate

`20260911134522_native_proposal_invoice_milestones.sql` adds the proposal settlement selector, manual receipt metadata and service-role-only receipt RPC. It guards issued mode changes and rejects checkout reservation/settlement in manual mode. Existing milestone RLS remains in force. The migration is prepared and tested only in an isolated local PostgreSQL fixture; hosted application belongs to the captain, with explicit approval for the billing/security change.

Before activation, captain must verify deployed commit and migration order, admin identity/receipt workflow, actual issued document paths, valid links and correct customer totals. Invoice issuance and delivery are separate approved operator actions. No live invoice, Stripe call, customer row update, email, deployment or migration execution was performed in this implementation lane. Production is not ready merely because local QA passes.

## Validation and limitations

Focused route/component/legacy tests, real local SQL migration tests and actual native-handler-to-local-SQL integration cover checkout suppression, signature/receipt separation, evidence attribution, exact amounts, replay, final acceptance and dashboard gating. Local native-route videos use synthetic API fixtures; later receipt states in those videos are fixtures, with their actual SQL/route behavior validated separately. The fixture schema reflects known required columns but is not the full hosted migration history or PostgREST environment.

Whole-tree typecheck retains existing unrelated errors in social-comment-inbox-ui.test.ts and ignored private PDF scripts. No full build or live customer/provider smoke was performed. Refunds, receipt corrections/reversal and invoice provider reconciliation are outside this slice; preserve conflicting records for operator review instead of replacing receipt evidence. Do not expose raw receipt references or private customer documents in public QA artifacts.
