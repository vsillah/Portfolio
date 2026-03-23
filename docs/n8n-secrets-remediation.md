# n8n Secrets Remediation — Completed

All hardcoded secrets and `$env.*` references have been migrated to **n8n Variables** (`$vars.*`), which are available on all n8n Cloud plans.

> **`$vars`** = n8n Variables (Settings → Variables). Available on all plans.
> **`$env`** = n8n Environment Variables. Enterprise only — not used.
> **Credentials** = n8n's encrypted credential store (OAuth, API keys attached to node types). Already in use for Supabase, Gmail, Slack, Anthropic, OpenAI, Apify.

## Required Variables (Settings → Variables)

### Production variables (used by non-STAG workflows)

| Variable | Value |
|----------|-------|
| `PORTFOLIO_BASE_URL` | `https://amadutown.com` |
| `SUPABASE_URL` | `https://byoriebhtbysanjhimlu.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Production Supabase Dashboard → Settings → API |

### Staging variables (used by STAG-suffixed workflows only)

| Variable | Value |
|----------|-------|
| `STAG_PORTFOLIO_BASE_URL` | Your Vercel preview URL (e.g. `https://portfolio-staging-ten.vercel.app`) |
| `STAG_SUPABASE_URL` | `https://xxissfhcdjivuhxwjyhv.supabase.co` |
| `STAG_SUPABASE_SERVICE_ROLE_KEY` | Dev Supabase Dashboard → Settings → API |
| `STAG_N8N_INGEST_SECRET` | `.env.staging` |
| `STAG_GEMINI_API_KEY` | `.env.staging` |
| `STAG_ELEVENLABS_API_KEY` | `.env.staging` |
| `STAG_OPENROUTER_API_KEY` | `.env.staging` |
| `STAG_RAG_QUERY_WEBHOOK_URL` | Staging RAG webhook URL |

### Production-only shared variables

| Variable | Value Source |
|----------|-------------|
| `N8N_INGEST_SECRET` | `.env.local` (production value) |
| `APIFY_TOKEN` | `.env.local` |
| `APP_BASE_URL` | Same as `PORTFOLIO_BASE_URL` |
| `GEMINI_API_KEY` | `.env.local` |
| `ELEVENLABS_API_KEY` | `.env.local` |

## Pattern: Code Nodes

Production workflows:
```javascript
const baseUrl = $vars.PORTFOLIO_BASE_URL;
const secret = $vars.N8N_INGEST_SECRET;
if (!baseUrl || !secret) throw new Error('Set PORTFOLIO_BASE_URL and N8N_INGEST_SECRET in n8n Variables');
```

STAG workflows:
```javascript
const baseUrl = $vars.STAG_PORTFOLIO_BASE_URL;
const secret = $vars.STAG_N8N_INGEST_SECRET;
if (!baseUrl || !secret) throw new Error('Set STAG_PORTFOLIO_BASE_URL and STAG_N8N_INGEST_SECRET in n8n Variables');
```

## Pattern: HTTP Request Nodes

Production: `={{ $vars.PORTFOLIO_BASE_URL }}/api/admin/outreach/ingest`
Staging: `={{ $vars.STAG_PORTFOLIO_BASE_URL }}/api/admin/outreach/ingest`

Production header: `=Bearer {{ $vars.N8N_INGEST_SECRET }}`
Staging header: `=Bearer {{ $vars.STAG_N8N_INGEST_SECRET }}`

## Workflows Fixed

### Production workflows → use `$vars.PORTFOLIO_BASE_URL`, `$vars.SUPABASE_URL`

| Workflow | Nodes Updated | Secrets Removed |
|----------|--------------|-----------------|
| WF-SLK | Dedupe Check, Mark Processed | `N8N_INGEST_SECRET`, hardcoded base URL |
| WF-CLG-004 | Cancel Pending Follow-Ups | `SUPABASE_SERVICE_ROLE_KEY`, hardcoded Supabase URL |
| WF-SOC-001 | Fetch Unprocessed Meetings, Save to Queue, Gemini Image Gen, ElevenLabs Voiceover | `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` |
| WF-SOC-002 | Fetch Content + Config, Update Status Published | `SUPABASE_SERVICE_ROLE_KEY` |
| WF-VEP-002 | Parse and POST Results, POST Raw to Market Intel | `N8N_INGEST_SECRET`, hardcoded base URL, `$env.N8N_INGEST_SECRET` |
| WF-WRM-001 | POST to Ingest API | `N8N_INGEST_SECRET`, hardcoded base URL |
| WF-WRM-002 | POST to Ingest API | `N8N_INGEST_SECRET`, hardcoded base URL |
| WF-WRM-003 | POST to Ingest API | `N8N_INGEST_SECRET`, hardcoded base URL |

### Staging workflows → use `$vars.STAG_PORTFOLIO_BASE_URL`, `$vars.STAG_SUPABASE_URL`

| Workflow | Nodes Updated | Variable Prefix |
|----------|--------------|-----------------|
| WF-SLK-STAG | Dedupe Check, Mark Processed | `STAG_PORTFOLIO_BASE_URL`, `STAG_N8N_INGEST_SECRET` |
| WF-CLG-004-STAG | Cancel Pending Follow-Ups | `STAG_SUPABASE_URL`, `STAG_SUPABASE_SERVICE_ROLE_KEY` |
| WF-SOC-001-STAG | Fetch Unprocessed Meetings, Save to Queue, Gemini Image Gen, ElevenLabs Voiceover, RAG Personal Context | `STAG_SUPABASE_*`, `STAG_GEMINI_API_KEY`, `STAG_ELEVENLABS_API_KEY`, `STAG_RAG_QUERY_WEBHOOK_URL` |
| WF-SOC-002-STAG | Fetch Content + Config, Update Status Published | `STAG_SUPABASE_URL`, `STAG_SUPABASE_SERVICE_ROLE_KEY` |
| WF-VEP-002-STAG | Parse and POST Results, POST Raw to Market Intel | `STAG_PORTFOLIO_BASE_URL`, `STAG_N8N_INGEST_SECRET` |
| WF-WRM-001-STAG | POST to Ingest API | `STAG_PORTFOLIO_BASE_URL`, `STAG_N8N_INGEST_SECRET` |
| WF-WRM-002-STAG | POST to Ingest API | `STAG_PORTFOLIO_BASE_URL`, `STAG_N8N_INGEST_SECRET` |
| WF-WRM-003-STAG | POST to Ingest API | `STAG_PORTFOLIO_BASE_URL`, `STAG_N8N_INGEST_SECRET` |

## Verification

After re-exporting workflows from n8n Cloud:

```bash
bash scripts/check-n8n-secrets.sh
```

Should report "Clean" with exit code 0.

## Credential Rotation

When rotating a secret (e.g. `N8N_INGEST_SECRET`):

1. Update the value in **n8n Settings → Variables**
2. Update the matching value in `.env.staging` (or `.env.local` for dev)
3. No workflow edits needed — `$vars` references resolve at runtime
