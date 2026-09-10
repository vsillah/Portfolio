# Native proposal recovery

Existing Sales conversation and audit screens load the latest proposal for their sales session through authenticated GET /api/proposals?sales_session_id=UUID. This reads only; it does not use the public viewed/sign/payment endpoints. Sorting uses created_at then id. Errors offer retry, expired auth refreshes once, and late responses from prior sessions are ignored.

ProposalModal opens the saved exact items, amount, terms and expiry. Existing conversation document controls remain available. Reopening does not generate another proposal. Intentional Create another proposal returns to the existing form, with a return-to-review action and no generation when no offer items are selected. Issued client links use https://amadutown.com; missing codes never fall back to public UUID URLs in this admin recovery path. This UI behavior is not a new server security boundary for legacy public endpoints.

No schema, dashboard, payment, agreement-generation or deployment changes are included. Existing payment and project-provisioning behavior remains outside this fix.

Validation:

- npx vitest run components/admin/sales/ProposalModal.recovery.test.tsx hooks/useSavedProposal.test.tsx app/api/proposals/route.test.ts — 12 passed.
- Changed-file ESLint and git diff --check passed.
- node scripts/qa/native-proposal-recovery.cjs
- QA_MOBILE=true node scripts/qa/native-proposal-recovery.cjs
- Local native routes with synthetic intercepted APIs, empty catalog, review/reload on conversation and audit at desktop/tablet/mobile widths. No API writes or public proposal reads. Existing Vercel analytics requests are aborted and listed separately as blockedExternalRequests; externalRequests records allowed external traffic (none).
- MP4s and synthetic screenshots remain ignored in local-private/native-recovery.
- Typecheck encounters baseline duplicate keys in lib/social-comment-inbox-ui.test.ts and a preserved ignored renderer from the held implementation branch. No new product type errors; full build not asserted green.

Captain verifies hosted behavior and both Vercel contexts before integration. No live client/provider smoke was run by this lane.

## Branded formatting

The existing review drawer and proposal PDF now share conservative text structure: known headings, literal paragraphs, numbered/bullet lists and a grouped payment row. Stored text is not HTML and is never injected as markup. The AmaduTown shield retains its portrait ratio; legal naming uses website-brand. PDF styling draws from PDF_BRAND and existing invoice/audit templates, with full item descriptions, kept headings and page numbering. Contract terms remain unchanged.

Formatting verification: 18 tests across the prior recovery suite plus lib/proposal-terms.test.ts, components/admin/sales/ProposalTerms.test.tsx and lib/proposal-pdf-format.test.ts. Tests cover ordinary multiline legacy text, explicit lists, literal unsafe HTML, long text and exact amounts/full descriptions through real PDF generation/extraction. The private candidate retained every approved source line and rendered as two visually checked pages. Final responsive bounds sweeps and paced local synthetic MP4s passed at 360/390/768/1440. No hosted/customer writes or uploads.
