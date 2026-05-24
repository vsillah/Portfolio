# Infisical Secret Map

This map records the Portfolio machine-secret source-of-truth layout. It is value-free: it lists names, ownership, environments, and runtime sinks only.

## Namespace

| Scope | Value |
| --- | --- |
| Infisical project slug | `portfolio` |
| Infisical project id | `b2634763-ea1d-448c-bf80-fccf6bb8e4a7` |
| Secret path | `/portfolio` |
| Environments | `dev`, `staging`, `prod` |

## Current State

As of 2026-05-21:

| Environment | State |
| --- | --- |
| `dev` | `/portfolio` exists and inventory-owned machine secrets are synced from the local runtime sink. Rotation baselines still need provider confirmation. |
| `staging` | `/portfolio` exists and inventory-owned machine secrets are synced. Existing staging baseline evidence remains in `docs/credential-inventory.json`; newly mapped secrets need provider confirmation. |
| `prod` | `/portfolio` exists and provider access is working. On 2026-05-21, 34 tracked Infisical-backed production secrets were bootstrapped from `.env.local` after approval; a value-free follow-up scan found 34 present, 0 empty, and 0 failed. Rotation baselines still require provider confirmation. See `docs/credential-prod-source-gap-2026-05-21.md`. |

## Source-Of-Truth Rules

- Infisical owns runtime/API secrets used by the application, workflows, automation, enrichment, model providers, and webhook authentication.
- 1Password owns human logins, app passwords, browser-session cookies, recovery material, and client-shared passwords.
- Vercel, n8n, Supabase, and local env files are runtime sinks. They should be synced from Infisical or 1Password, not treated as canonical records.
- `APIFY_TOKEN` is a legacy/local alias for the canonical `APIFY_API_TOKEN` shape. Normalize new workflows to `APIFY_API_TOKEN`.
- `LINKEDIN_COOKIE`, `GMAIL_APP_PASSWORD`, and admin E2E login material remain 1Password-side credentials.

## Staging n8n Variable Names

Staging n8n workflows use STAG-prefixed Variables, while the Next.js staging runtime may still expose app-side names such as `N8N_INGEST_SECRET`. Track the STAG-prefixed n8n Variables as separate staging-only inventory entries so rotation packets can update both sides deliberately.

| n8n staging variable | Coupled app/provider secret |
| --- | --- |
| `STAG_N8N_INGEST_SECRET` | App-side `N8N_INGEST_SECRET` for staging ingest auth |
| `STAG_SUPABASE_SERVICE_ROLE_KEY` | Staging Supabase service role key |
| `STAG_GEMINI_API_KEY` | Gemini key used by STAG social workflows |
| `STAG_ELEVENLABS_API_KEY` | ElevenLabs key used by STAG voice workflows |
| `STAG_OPENROUTER_API_KEY` | OpenRouter key used by STAG RAG/query workflows |

Do not rotate only one side of a coupled staging secret. Update Infisical, Vercel/app runtime sinks, and n8n Variables in the same staged packet, then verify with synthetic or test-owned workflow inputs.

## Operator Checks

Use these commands for key-name and access validation. They must not print values.

```bash
npm run credentials:smoke -- --env dev --require-provider-access
npm run credentials:smoke -- --env staging --require-provider-access
npm run credentials:report -- --env staging --check-sinks
```

Use `credentials:baseline-template` for any entry reporting `needs-baseline`. Baseline dates should come from Infisical audit/version metadata, provider dashboard/API events, 1Password item history, or an approved rotation packet.

## Production Import Gate

Before writing production values into Infisical:

1. Confirm each value from the production provider dashboard/API, existing production secret manager, or a verified production runtime sink metadata path.
2. Prepare an approval packet listing env var names, source provider, target sinks, smoke commands, rollback path, and revocation plan.
3. Populate Infisical `prod:/portfolio`.
4. Sync runtime sinks.
5. Verify production-safe smoke checks.
6. Revoke old provider credentials only after the verification gate passes and approval is explicit.
