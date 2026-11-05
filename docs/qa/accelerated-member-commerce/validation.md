# Accelerated member commerce validation

Branch: `codex/accelerated-member-commerce`. Staging project: `xxissfhcdjivuhxwjyhv`. Production schema, provider APIs, and live records were not changed.

## Captain review corrections

- A signed `payment_intent.succeeded` event now transitions an order only when its PaymentIntent id matches the id already recorded on that order. The conditional update remains replay-safe; a mismatched event cannot reach the email, guarantee, campaign, or Printful paths.
- Selecting a reviewed quote service now atomically creates one member-owned `quote_pending` order and one immutable, recommendation-bound order item. Repeated selection returns the same order. The member opens `/member/quote?orderId=…`, where the submitted order reference is authenticated and validated server-side. A quote contact link binds the submitted contact record to that order. No price, payment, or client-project membership is inferred.

## Completed checks

- Focused Vitest command across Accelerated, cart, checkout, payment intent, webhook, contact, admin Decision File, and proposal route tests: **79 passed in 12 files**. The webhook tests cover mismatched PaymentIntent and exact replay. Quote API tests cover authentication, account email binding, replay, and wrong-member/stale order rejection.
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=inert-public-key SUPABASE_SERVICE_ROLE_KEY=inert-service-key NODE_OPTIONS=--max-old-space-size=8192 npm run build` — passed. Real provider keys were not used.
- Staging target, mirror migration hashes, and one-file `supabase db push --dry-run --linked --workdir /tmp/portfolio-accelerated-migration-audit.iTJFJM` checked before each migration apply. Corrective migrations `20261105193000_accelerated_quote_order_binding.sql` and `20261105194500_accelerated_quote_lineage_guard.sql` each applied once to staging. Migration history has 131 entries, one per commerce migration; post-apply dry run is up to date. No history repair.
- `staging-transaction-smoke.sql` passed against installed staging functions inside `BEGIN; … ROLLBACK;`. It covers approved fixed and quote branches, server-priced checkout, quote-order/contact creation and replay, wrong-member and stale revision rejection, changed catalog rejection, immutable quote lineage, service-role-only RPCs, authenticated RLS isolation, legacy store order compatibility, and no project membership. All synthetic fixture and contact rows rolled back.
- Post-smoke staging residue: zero synthetic users, quote orders, contact links, contact records, and memberships. The one pre-existing order and order item retain their exact old-column hashes (`6d3771fecb25fbbf4cc51e79693b5e08`, `ab2b14043ada775fdd266b4cbbf088bc`). New quote lineage is absent on those rows. PostgreSQL sequences can advance after rollback; last observed values were cart 20, orders 19, order items 31, and contact submissions 37. No sequence reset was attempted.
- Rendered synthetic dashboard and quote form checked at 390, 768, and 1280 px, with no horizontal overflow. The integrated browser control was unavailable during correction QA, so Playwright was used against the isolated localhost worktree. Desktop and mobile MP4s show the order list → quote form path and a disabled preview submit; both decode cleanly as H.264 at 24 fps. No live contact submission, checkout, Stripe request, or provider call was made.

## Remaining gates

Draft PR #1216 needs captain review. The MP4s prove the synthetic presentation path; the rolled-back SQL proves the staging transaction. An authenticated browser session against staging, client-facing Human QA, merge/deployment, and any production migration remain separate gates.
