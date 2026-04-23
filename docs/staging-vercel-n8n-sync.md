# Staging Vercel ↔ n8n environment sync

Use this when deploying **portfolio-staging** (or any staging Vercel environment) so the Next.js app calls **ATAS Staging** workflows, not production paths.

## Steps

1. Open your local [`.env.staging`](../.env.staging) (gitignored). If you do not have one, copy [`.env.staging.example`](../.env.staging.example) and fill values.
2. In **Vercel → Project → Settings → Environment Variables**, select the **Preview** or **Staging** environment (whichever backs `portfolio-staging-ten.vercel.app`).
3. For every `N8N_*` variable your staging build reads at runtime, set the **same name** and **same value** as in `.env.staging`. Primary definitions live in [`lib/n8n.ts`](../lib/n8n.ts) (`process.env.N8N_...`).
4. **Redeploy** staging after changing env vars (Vercel does not apply new env to past deployments).
5. Confirm webhook URLs use the **Production** URL from each STAG workflow’s Webhook node (`…/webhook/<uuid-or-path>`), not `/webhook-test/…` (see warning in `lib/n8n.ts` for `N8N_LEAD_WEBHOOK_URL`).

## Variables to double-check

| Variable | Purpose |
|----------|---------|
| `N8N_BASE_URL` | Usually `https://amadutown.app.n8n.cloud` |
| `N8N_WEBHOOK_URL` | STAG RAG chat / Vapi-style webhook |
| `N8N_DIAGNOSTIC_WEBHOOK_URL` | Optional; falls back to `N8N_WEBHOOK_URL` |
| `N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL` | Optional; falls back to `N8N_LEAD_WEBHOOK_URL` |
| `N8N_EBOOK_NURTURE_WEBHOOK_URL` | STAG LMN-001 |
| `N8N_LEAD_WEBHOOK_URL` | Lead qualification / completion (if used on staging) |
| `N8N_CLG002_WEBHOOK_URL` / `N8N_CLG003_WEBHOOK_URL` | STAG outreach |
| `N8N_WRM001_WEBHOOK_URL` … `N8N_WRM003_WEBHOOK_URL` | STAG warm lead scrapers |
| `N8N_VEP001_WEBHOOK_URL` / `N8N_VEP002_WEBHOOK_URL` | STAG value evidence |
| `N8N_SOC001_WEBHOOK_URL` / `N8N_SOC002_WEBHOOK_URL` | STAG social pipelines |
| `N8N_TASK_SLACK_SYNC_WEBHOOK_URL` | STAG task sync |
| `N8N_WEBHOOK_SECRET` | Must match what n8n sends (if applicable) |
| `N8N_INGEST_SECRET` | Bearer for `/api/admin/outreach/ingest` on staging |

## Agent / automation

Cursor **n8n MCP** uses `N8N_API_URL` + `N8N_API_KEY` (or Cloud-specific vars per MCP README). That is separate from the Next.js app’s `N8N_*_WEBHOOK_URL` values.

## Drift detection (STAG ↔ PROD)

Once STAG and PROD are in sync, keep them that way with the drift checker:

```bash
# Fail build/CI on drift
npm run n8n:drift-check

# Print-only mode (never fails)
npm run n8n:drift-check:warn
```

Requires `N8N_API_KEY` in `.env.local` (Settings → API Keys in n8n Cloud). The
script diffs each `WF-…` / `WF-…-STAG` pair node-by-node, ignoring expected
env-specific fields (credentials, webhook IDs, positions, Slack channel IDs,
URLs). Edit `WORKFLOW_PAIRS` in [`scripts/n8n-workflow-drift-check.ts`](../scripts/n8n-workflow-drift-check.ts) to add new pairs or expand the ignore list.

This catches regressions like the 2026-04-22 `Get Lead Data` misconfig where
PROD diverged from STAG silently for weeks.

## Related

- [docs/staging-n8n-activation-matrix.md](./staging-n8n-activation-matrix.md) — workflow IDs, test status, blockers
- [docs/staging-workflow-updates-checklist.md](./staging-workflow-updates-checklist.md) — per-workflow isolation checklist
