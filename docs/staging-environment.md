# Staging environment setup

Use a **staging** deploy to validate n8n, Stripe test mode, and Supabase **non-production** data end-to-end before promoting to production.

## 1. What “staging” means in this repo

| Setting | Purpose |
|--------|---------|
| `NEXT_PUBLIC_APP_ENV=staging` | UI **staging** banner; enables **automatic n8n defaults** (see below). |
| Staging Supabase project | Isolated DB — do not point staging at production Supabase. |
| Staging n8n URLs | `N8N_BASE_URL` + `N8N_*_WEBHOOK_URL` for a **clone/test** workspace (see [integration testing matrix](./integration-testing-environment-matrix.md)). |
| Stripe **test** keys | `sk_test_` / `pk_test_` and test webhook secret. |

## 2. Automatic n8n flags (minimal manual steps)

Implemented in `lib/n8n-runtime-flags.ts`:

- If `NEXT_PUBLIC_APP_ENV=staging` **and** you **omit** `MOCK_N8N` and `N8N_DISABLE_OUTBOUND` from Vercel → the app behaves as **real n8n** (mock off, outbound on).
- To force mocks on staging (e.g. a one-off test), set `MOCK_N8N=true` or `N8N_DISABLE_OUTBOUND=true` in the staging project’s env.

**Verify after deploy:** `GET https://your-staging-host/api/health` → JSON includes `deploymentTier: "staging"`, `n8n.mockEnabled`, `n8n.outboundDisabled`.

## 3. Vercel (recommended layout)

**Option A — Separate Vercel project “amadutown-staging”**

1. Duplicate the production project or connect the same repo.
2. **Branch:** deploy from `staging` (or `main` with a dedicated branch — your choice).
3. **Environment variables** (Staging / Preview for that project only):
   - `NEXT_PUBLIC_APP_ENV=staging`
   - `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BASE_URL` = staging URL
   - Full Supabase **staging** keys (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`)
   - All `N8N_*` URLs pointing at **staging n8n** (not production, if DB is not prod)
   - Stripe test keys, test `STRIPE_WEBHOOK_SECRET`, test webhook endpoint in Stripe Dashboard
4. **Do not** copy `MOCK_N8N` or `N8N_DISABLE_OUTBOUND` from `.env.example` unless you want mocks.

**Option B — Preview deployments**

Preview URLs are still **Tier B** in the matrix (often `MOCK_N8N=true` for PRs). For integration-heavy preview, set `NEXT_PUBLIC_APP_ENV=staging` on that preview’s env **and** staging n8n URLs — then omitted flags default to real n8n the same way.

## 4. Local simulation of staging

```bash
# .env.local (snippet)
NEXT_PUBLIC_APP_ENV=staging
MOCK_N8N=
N8N_DISABLE_OUTBOUND=
# Point N8N_* at your staging n8n workspace; use staging Supabase keys.
```

Empty/unset `MOCK_N8N` and `N8N_DISABLE_OUTBOUND` after `NEXT_PUBLIC_APP_ENV=staging` → real webhooks.

## 5. Related docs

- [Integration testing — environment matrix](./integration-testing-environment-matrix.md)
- [Regression & smoke checklist](./regression-smoke-checklist.md)
- `.env.example` — variable names and comments

---

*Last updated: 2026-03-20*
