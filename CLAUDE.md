# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production (runs build:knowledge first, requires network for Google Fonts)
npm run lint         # ESLint
npm test             # Run unit tests (vitest)
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Playwright end-to-end tests
npm run db:health-check          # Check database row counts vs baseline
npm run db:health-check:update   # Rebaseline after intentional data changes
```

> If the build reports a "missing" page, clear the cache first: `rm -rf .next && npm run build`. Do not assume the route was deleted.

**Build note:** `npm run build` pre-generates `lib/chatbot-knowledge-content.generated.ts` via `scripts/build-chatbot-knowledge.ts`. Do not import that file directly — it is auto-generated.

## Architecture

### Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Supabase (Postgres + Auth + Storage), Stripe, n8n (workflow automation), Vapi (voice AI), Playwright + Vitest.

### Directory layout

```
app/                  # Next.js App Router pages and API routes
  admin/              # Admin dashboard (protected, admin-only)
  api/                # API route handlers
    admin/            # Admin-only API routes (use verifyAdmin)
  auth/               # Login / signup / callback
  client/             # Client-facing dashboard (token-based)
  checkout/           # Storefront checkout flow
  services/           # Public services pages
  store/              # Public store
  resources/          # Lead magnets / resources
  tools/              # Interactive tools (audit, ROI calculator)
  campaigns/          # Attraction campaign landing pages
components/           # Reusable UI components
lib/                  # Shared logic, integrations, utilities
  supabase.ts         # Supabase client (public) + supabaseAdmin (server-only)
  auth.ts             # Client-side auth helpers
  auth-server.ts      # Server-side auth (API routes)
  n8n.ts              # n8n webhook trigger helpers
  admin-nav.ts        # Admin sidebar navigation tree (single source of truth)
  types/              # Shared TypeScript types (e.g. store.ts)
migrations/           # SQL migration files (YYYY_MM_DD_description.sql)
scripts/              # Build and maintenance scripts
n8n-exports/          # n8n workflow JSON exports
docs/                 # Project documentation and postmortems
```

### Supabase clients

- `supabase` (from `lib/supabase.ts`) — public anon client, for client-side use only.
- `supabaseAdmin` — service role client, **server-side only** (returns `null` on the client). Use in API routes when bypassing RLS is needed.

### API route authentication

**Admin routes** (`app/api/admin/**`): use `verifyAdmin(request)` from `@/lib/auth-server`.

```ts
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

const auth = await verifyAdmin(request)
if (isAuthError(auth)) {
  return NextResponse.json({ error: auth.error }, { status: auth.status })
}
```

**n8n / webhook ingest routes** (`**/ingest/route.ts`, `**/trigger/route.ts`): authenticate via Bearer token using `N8N_INGEST_SECRET` env var — do **not** use `verifyAdmin`.

**All API routes:** set `export const dynamic = 'force-dynamic'` for routes that read from the database. Dynamic segment params come from the second argument: `{ params }: { params: { id: string } }`.

### Admin features

Admin navigation is driven by `components/admin/AdminSidebar.tsx`. The nav tree is defined in **`lib/admin-nav.ts`** — this is the single source of truth. When adding a new admin page:

1. Create the page at `app/admin/{feature}/page.tsx` using the dark theme pattern and wrap with `<ProtectedRoute requireAdmin>`.
2. Add an entry to `lib/admin-nav.ts` under the correct category (Pipeline, Sales, Post-sale, Quality & insights, Configuration).
3. If it is a primary hub, consider a card/feed in `app/admin/page.tsx`.

Admin card color palette: Chat/Communication = amber→orange, Analytics = purple→pink, Content = blue→cyan, Users = green→teal, System = cyan→blue, Sales = emerald→teal, Testing = rose→red, Alerts = yellow→orange.

### n8n integration

- `N8N_BASE_URL` in `.env.local` controls which n8n instance webhooks target.
- Use `n8nWebhookUrl('path')` from `lib/n8n.ts` to build webhook URLs.
- Per-workflow env vars (e.g. `N8N_VEP001_WEBHOOK_URL`) override the base URL.
- Trigger functions in `lib/n8n.ts` should return `{ triggered: boolean, message?: string }`.
- n8n workflows are also accessible via the n8n MCP tool — prefer MCP over parsing exported JSON.

### Database / migrations

- Migration files live in `migrations/` with the naming convention `YYYY_MM_DD_description.sql`.
- Every schema change applied via MCP or any tool **must** have a corresponding file on disk.
- Before writing INSERT/UPSERT code for an existing table, inspect the schema to identify NOT NULL columns without defaults.
- For tables with `display_order` / `sort_order`: assign sequential values on INSERT (fetch current max + 1), never rely on a default of 0. Use index-based reassignment for reordering, not value swaps.
- When enum-like values change (`service_type`, `status`, `content_type`, etc.), update all layers: DB CHECK constraint, API validation, frontend union types, and seed/test data in the same change.

**Database health check:** A Husky pre-push hook runs `scripts/database-health-check.ts`, which compares row counts against `.database-baseline.json` and blocks the push if data loss is detected. After any migration that seeds or deletes rows, run:

```bash
npx tsx scripts/database-health-check.ts --update
git add .database-baseline.json && git commit -m "Update database baseline"
```

### Supabase RLS

- Prefer `auth.uid()` and JWT claims in RLS policies to avoid circular references.
- Use `SECURITY DEFINER` helper functions for role checks (e.g. `is_admin()`) to break dependency cycles.
- Server-side code that must bypass RLS should use `supabaseAdmin` (service role), combined with application-level `verifyAdmin`.

### API performance

When a list API resolves related data per item: batch-fetch by dimension using `.in('id', ids)` or `.eq(...).in(...)`, run batches in parallel via `Promise.all`, then resolve in memory using maps. Never add per-item DB calls inside a result loop (N+1). See `app/api/admin/sales/bundles/[id]/resolve/route.ts` for the reference pattern.

## Commit conventions

Use scoped prefixes: `db:`, `lib:`, `api:`, `ui:`, `test:`, `config:`, `style:`, `feat:`.

For changes spanning 10+ files or 3+ architectural layers (DB, lib, API, UI, tests), commit incrementally by layer rather than in a single batch.

## Debugging approach

For behavioral bugs (wrong data, silent failure, unexpected state): instrument first, reproduce, cite the evidence, then fix. Only change what the evidence points to. Remove all temporary debug instrumentation (`#region agent log`, `127.0.0.1:7242` fetch calls, `[DEBUG]` console logs) before finishing.

## Testing

After significant changes (new page, new user flow, new API a UI depends on), run a smoke test via **Admin → Testing** before claiming completion. Add an E2E scenario to `lib/testing/scenarios.ts` if none exists for the new functionality.

Unit tests use Vitest and live alongside source files (e.g. `lib/guarantees.test.ts`). Run a single test file: `npx vitest run lib/guarantees.test.ts`.

---

# AmaduTown / Mad Hadda — Claude Code Context

## Who I Am
Vambah Sillah (Mad Hadda). Founder of AmaduTown Advisory Solutions.
Mission: Technology as the great equalizer for minority-owned businesses.

## Current Project
Building the AmaduTown website + YouTube content production pipeline.

## Content Calendar — March 2026
[Paste the full calendar content here or reference the file path]

## Products & Pricing
[Paste from your pricing docs]

## HeyGen Setup
- Avatar ID: [your avatar ID from HeyGen]
- Voice ID: [your ElevenLabs voice ID]
- MCP endpoint: https://mcp.heygen.com/mcp/v1/

## Website URL (for B-roll screenshots)
[your site URL]

## Scripts Location
All scripts are in Google Drive — ATAS YT series.
[Paste the Drive links]

## Brand Guidelines
- Colors: [your brand colors]
- Tone: Conversational, mission-driven, no-BS
- Sign-off: "Let's get it"
