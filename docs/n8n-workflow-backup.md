# n8n Workflow Backup Strategy

## Two-folder approach

| Folder | Purpose | In Git? |
|--------|---------|---------|
| **n8n-exports/** | Sanitized templates with placeholders (e.g. `REPLACE_WITH_GEMINI_API_KEY`) | Yes — used by template products |
| **n8n-backups/** | Real exports from n8n (with credentials) | No — gitignored |

## Workflow

1. **In n8n** — Configure API keys, tokens, and secrets directly in nodes. Workflows run with real credentials.
2. **When exporting for backup** — Save to `n8n-backups/` (gitignored). Never commit these.
3. **When updating templates in the repo** — Export from n8n, run a sanitize step to replace secrets with placeholders, then save to `n8n-exports/` and commit.

## Placeholders used in n8n-exports

Replace these in n8n after import (or when exporting for backup, replace with placeholders before committing):

- `REPLACE_WITH_GEMINI_API_KEY` — Google AI Studio API key
- `REPLACE_WITH_ELEVENLABS_API_KEY` — ElevenLabs xi-api-key
- `REPLACE_WITH_APIFY_API_TOKEN` — Apify Bearer token
- `REPLACE_WITH_N8N_INGEST_SECRET` — N8N_INGEST_SECRET (must match .env.local)
- `REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY` — Supabase service role JWT

## Environment variables in n8n

n8n **Environment Variables** (Settings on Enterprise plans) are not available on n8n Cloud Free or self-hosted. Use:

- **n8n Credentials** for HTTP Header Auth, OAuth, etc. — stored in n8n's encrypted store, not in exported JSON
- **Hardcoded values in nodes** — only in n8n; when exporting for the repo, replace with placeholders first
