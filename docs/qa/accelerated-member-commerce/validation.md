# Accelerated member commerce validation

Branch: `codex/accelerated-member-commerce`. Staging project: `xxissfhcdjivuhxwjyhv`. Production schema, migration history, provider APIs, and live records were not changed.

## Completed checks

- `npx vitest run app/api/cart/route.test.ts app/api/checkout/route.test.ts app/api/payments/create-intent/route.test.ts app/api/payments/webhook/route.test.ts app/api/accelerated/member/route.test.ts app/api/accelerated/member/recommendations/\[id\]/select/route.test.ts lib/accelerated-member-checkout.test.ts` — 45 passing.
- `git diff --check` — clean.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build` with inert `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` placeholders — pass. The first build had no Supabase variables in this isolated worktree; the default 4 GB heap also exhausted during type checking. No real provider endpoint or key was used for the passing build.
- Staging migration SQL executed inside `BEGIN; ... ROLLBACK;` — pass. Follow-up read-only checks found zero persisted commerce columns and functions.
- Staging history mirror `supabase db push --dry-run --linked --workdir /tmp/portfolio-accelerated-migration-audit.iTJFJM` — exactly `20261105180647_accelerated_member_commerce.sql` pending. No history repair or schema push occurred.
- Rendered browser QA of the synthetic `?qa=orders` state at 390, 768, and 1280 px; the `?qa=assessed` empty-order/no-project state at 1280 px; fixed and quote preview actions; and the dedicated `/member/quote` form at 390 and 1280 px. No live contact submission, checkout, or provider call was made.
- Privacy-safe synthetic frame-capture MP4s: `accelerated-member-desktop-walkthrough.mp4` (14 seconds) and `accelerated-member-mobile-walkthrough.mp4` (12 seconds). Both decode cleanly as H.264 at 24 fps; source frames are in `walkthrough-frames/`. These are UI walkthroughs, not proof of a live payment or submitted quote.

## Remaining gates

- The authenticated full transaction remains to be exercised after the staging migration.
- Draft PR #1216 is open. Both Vercel preview contexts are pending. The reviewed selection RPC cannot run against staging or production until the migration is applied to that environment.
- Staging-only migration apply and transactional smoke require a separate continuation after this read-only history audit. Production migration, merge, deployment, provider calls, and live-record writes remain out of this lane's current scope.
