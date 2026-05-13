# Credential Baseline Evidence

Last updated: 2026-05-13

This note records the value-free evidence used to replace the staging `pending-provider-confirmation` baselines in `docs/credential-inventory.json`.

No secret values were read, printed, committed, or copied into this file. The evidence below comes from provider metadata only: n8n credential names/types/timestamps, Vercel environment-variable metadata, 1Password item metadata, or an operator-confirmed session update.

## Staging Baselines

| Secret | Baseline | Evidence |
| --- | --- | --- |
| `N8N_INGEST_SECRET` | 2026-04-16 | n8n credential metadata for `ATAS Ingest Bearer Auth`, updated 2026-04-16T03:44:21Z. |
| `SUPABASE_SERVICE_ROLE_KEY` | 2026-03-22 | n8n credential metadata for `Supabase Service Role`, updated 2026-03-22T00:38:59Z. |
| `OPENAI_API_KEY` | 2026-04-19 | Vercel Preview metadata for `OPENAI_API_KEY`, updated 2026-04-19T12:04:06Z. |
| `ANTHROPIC_API_KEY` | 2026-03-21 | n8n credential metadata for `Anthropic Staging Account`, updated 2026-03-21T14:11:17Z. |
| `OPENROUTER_API_KEY` | 2026-03-21 | n8n credential metadata for `OpenRouter Staging Account`, updated 2026-03-21T15:06:12Z. |
| `GEMINI_API_KEY` | 2026-03-22 | n8n credential metadata for `Gemini API Key`, updated 2026-03-22T00:45:06Z. |
| `ELEVENLABS_API_KEY` | 2026-03-22 | n8n credential metadata for `ElevenLabs API Key`, updated 2026-03-22T00:45:54Z. |
| `APIFY_API_TOKEN` | 2026-03-22 | n8n credential metadata for `Apify API Token`, updated 2026-03-22T00:44:30Z. |
| `STRIPE_SECRET_KEY` | 2026-05-13 | Approved staging-only rotation drill: Infisical staging `/portfolio` secret synced, local and `portfolio-staging` Vercel runtime sinks updated, staging redeployed, and Stripe API smokes returned 200. |
| `STRIPE_WEBHOOK_SECRET` | 2026-05-13 | Approved staging-only rotation drill: Infisical staging `/portfolio` secret synced, local and `portfolio-staging` Vercel runtime sinks updated, Stripe destination URL corrected to `/api/payments/webhook`, and a signed staging webhook probe returned 200. |
| `GITHUB_TOKEN` | 2026-05-13 | Approved staging-only rotation drill: Infisical staging `/portfolio` secret synced, local and `portfolio-staging` Vercel runtime sinks updated, and GitHub repo-read smoke returned 200. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | 2026-05-13 | Vercel Preview metadata after approved preview sync on 2026-05-13T13:27:32Z. |
| `LINKEDIN_COOKIE` | 2026-05-13 | Operator added a current LinkedIn `li_at` session cookie to local env on 2026-05-13. |
| `GMAIL_APP_PASSWORD` | 2026-05-01 | 1Password `Portfolio / staging` item metadata for `GMAIL_APP_PASSWORD`, created/updated 2026-05-01T14:48:30Z. |

## Evidence Limits

- Infisical source-of-truth history was not used in this pass because the available CLI path returns secret values by default. A future safe adapter should query Infisical metadata without returning values.
- Vercel metadata proves environment-variable presence/update time, not necessarily upstream provider key creation time.
- n8n credential metadata proves encrypted credential item update time, not necessarily upstream provider key creation time.
- `LINKEDIN_COOKIE` is a browser-session credential and may expire outside the normal cadence if LinkedIn invalidates the session.
