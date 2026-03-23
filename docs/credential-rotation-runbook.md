# Credential Rotation Runbook

After rotating any API credential used by n8n workflows or the Next.js app, follow this checklist to verify the new credential works end-to-end.

## Quick Reference: Where Credentials Live

| Credential | Next.js `.env.local` | n8n Env Var | n8n Credential Store |
|------------|---------------------|-------------|---------------------|
| N8N_INGEST_SECRET | `N8N_INGEST_SECRET` | `N8N_INGEST_SECRET` | - |
| OpenAI | `OPENAI_API_KEY` | - | `openAiApi` |
| Anthropic | `ANTHROPIC_API_KEY` | - | `anthropicApi` |
| OpenRouter | `OPENROUTER_API_KEY` | - | `openRouterApi` |
| Apify | `APIFY_API_TOKEN` | `APIFY_API_TOKEN` | `apifyApi` |
| Hunter.io | - | - | `hunterApi` |
| Pinecone | - | - | `pineconeApi` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `STRIPE_WEBHOOK_SECRET` | - |
| Supabase service role | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | - |
| Gemini | - | `GEMINI_API_KEY` | - |
| ElevenLabs | - | `ELEVENLABS_API_KEY` | - |

## Rotation Steps

### 1. Update the credential

- **n8n Credential Store**: n8n Editor → Credentials → select → update key → Save
- **n8n Environment Variable**: n8n Settings → Environment Variables → update value → restart n8n
- **Next.js `.env.local`**: Update the value, restart dev server or redeploy

### 2. Verify with Credential Rotation Smoke Test

Go to **Admin → Testing** and run the **Credential Smoke** preset:

1. Open Admin → Testing
2. Expand "Start New Test Run"
3. Click the **Credential Smoke** preset button
4. Click **Start Test Run**
5. Verify the run completes with 0 errors

This fires test payloads to the ingest endpoints (outreach, value-evidence) and confirms they accept the new `N8N_INGEST_SECRET`.

### 3. Verify n8n workflows

For credentials used by n8n workflows (OpenAI, Anthropic, Apify, Hunter, Pinecone):

1. Open the relevant workflow in the n8n editor
2. Click "Test workflow" to run it with test data
3. Confirm no credential errors in the execution log

### 4. Verify Stripe (if rotated)

1. Go to Admin → Testing → Client Journey Scripts
2. Click **Create Test Checkout**
3. Complete checkout with card `4242 4242 4242 4242`
4. Verify the payment appears in Stripe Dashboard (test mode)

### 5. Verify Supabase service role (if rotated)

1. Run the Credential Smoke test (step 2 above) — ingest routes use `supabaseAdmin`
2. Verify Admin → Leads page loads (uses service role for data fetching)

## Workflows Affected by Each Credential

| Credential | Workflows |
|------------|-----------|
| `N8N_INGEST_SECRET` | All ingest routes (outreach, value-evidence, market-intelligence, cost-events, meetings) |
| `openAiApi` | WF-CLG-002 (outreach gen), WF-VEP-001 (evidence extraction), WF-MCH (meeting handler) |
| `anthropicApi` | WF-CLG-002 (fallback LLM) |
| `openRouterApi` | WF-CLG-002 (model routing) |
| `apifyApi` | WF-CLG-001 (cold lead sourcing), WF-VEP-002 (social listening) |
| `hunterApi` | WF-CLG-001 (email verification) |
| `pineconeApi` | WF-RAG-INGEST (knowledge base), Chat workflow (RAG retrieval) |
| `STRIPE_WEBHOOK_SECRET` | WF-001 (payment intake) |
| `SUPABASE_SERVICE_ROLE_KEY` | WF-SOC-001, WF-SOC-002, WF-CLG-004, all ingest routes |

## After Rotation Checklist

- [ ] Updated credential in source (n8n / .env.local / Vercel)
- [ ] Ran Credential Smoke test from Admin → Testing (passed)
- [ ] Tested affected n8n workflow(s) in editor (passed)
- [ ] Verified no 401/403 errors in server logs
- [ ] Updated `.env.example` if the variable name changed
