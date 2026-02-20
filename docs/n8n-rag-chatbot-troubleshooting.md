# n8n RAG Chatbot — Troubleshooting (MCP Findings)

This doc summarizes findings from using the n8n MCP to inspect the **RAG Chatbot for AmaduTown using Google Gemini** workflow and related executions.

## Workflow status (as of check)

- **Workflow ID:** `nWF9u3cNrB7BRtb5`
- **Name:** RAG Chatbot for AmaduTown using Google Gemini
- **Active:** Yes
- **n8n API:** Connected (e.g. `n8n.amadutown.com`)

## Chat path and knowledge base

1. **Entry:** "When chat message received" (Chat Trigger) → **Process External History** → **Fetch Dynamic Prompt** → **Merge Prompt Data** → **Fetch Knowledge** → **Merge Knowledge Data** → **Check Diagnostic Mode** → **AI Agent** → …
2. **Fetch Knowledge** node:
   - **URL:** `https://amadutown.com/api/knowledge` (hardcoded; correct)
   - **Response:** text, timeout 15s
   - **On error:** `continueRegularOutput` (workflow continues without knowledge)
3. **Merge Knowledge Data** sets `dynamicKnowledge` from `$json.body || $json` (HTTP response body).
4. **AI Agent** system message includes: `{{ $json.dynamicKnowledge || '' }}` — so when Fetch Knowledge succeeds, the agent gets the doc content.

So when the **app** successfully calls the chat webhook, the workflow **does** call the knowledge base; if the app never reaches n8n, the knowledge step never runs.

## Why you might see the fallback message

The "Our chat service isn't responding" message is returned by the **Next.js app** when:

- `N8N_WEBHOOK_URL` is not set in the environment where the app runs (e.g. production), or
- The request to n8n fails (timeout, 502, 404, 500, network error).

So the failure is **between the app and n8n**, not necessarily inside the workflow.

**What to check:**

1. **App env (e.g. Railway/Vercel):**  
   `N8N_WEBHOOK_URL` must be the **chat** webhook URL, e.g.  
   `https://n8n.amadutown.com/webhook/8d72c71a-90a3-4667-b781-561ee99e3700/chat`  
   (webhookId from the "When chat message received" node).
2. **App logs:**  
   Look for `[n8n] All attempts failed` and the returned `fallbackReason` (e.g. "N8N_WEBHOOK_URL not configured", "n8n request timed out", "n8n workflow not found (404)").
3. **n8n reachability:**  
   From the same environment as the app, ensure the chat webhook is reachable (e.g. curl POST with `action`, `sessionId`, `chatInput`). If you use a tunnel, ensure it’s up and not returning 502.

## Workflow validation (MCP)

`n8n_validate_workflow` reported:

- **Errors (5):**  
  Process External History (Code node: "Cannot return primitive values directly"); AI Agent and RAG Query Agent (both `continueOnFail` and `onError` — use only `onError`); RAG Query Webhook (responseNode mode should set `onError: continueRegularOutput`); Vector Store tool missing `toolDescription`.
- **Warnings (78):**  
  Various (Switch rules, Code error handling, typeVersions, optional chaining in expressions, etc.). None of these alone explain the app-level fallback.

Autofix did not apply any changes (no automatic fixes available for this workflow).

## $env usage (important for this instance)

The **Fetch Dynamic Prompt** node uses:

```text
={{ $env.PORTFOLIO_URL || 'https://amadutown.com' }}/api/prompts/chatbot
```

This project’s n8n instance **blocks `$env`** in node expressions ("access to env vars denied"). If that expression runs, it can cause the node to fail. The node has `onError: continueRegularOutput`, so the workflow may continue with a fallback prompt, but to avoid any risk of failure or inconsistent behavior, the URL should be **hardcoded** (e.g. `https://amadutown.com/api/prompts/chatbot`) or provided via a Credential, not `$env`.

**Fetch Knowledge** already uses a hardcoded URL and does not use `$env`.

## Recent executions

- **RAG Chatbot workflow:** Recent **webhook** executions listed in MCP were **success** (e.g. 14429, 14427, …). Those were for the **RAG Query** path (path `amadutown-rag-query`), not the **chat** path (Chat Trigger).
- **Errors** for this workflow (13501, 13505, 13506) were **trigger**-mode runs (e.g. Google Drive Trigger), not chat webhook.

So from MCP we don’t see recent **chat** webhook failures; the fallback you see is most likely due to the **app** not reaching n8n (wrong/missing URL or network/tunnel issue).

## Quick checklist

| Check | Where |
|-------|--------|
| `N8N_WEBHOOK_URL` set and equals chat webhook URL | App env (e.g. production) |
| App logs for `[n8n]` and `fallbackReason` | Server logs |
| Chat webhook reachable (curl POST) | Same network as app |
| n8n and tunnel up (no 502) | n8n / Cloudflare |
| Fetch Dynamic Prompt URL without `$env` | n8n workflow (optional hardening) |

See also: **N8N_PROMPT_SYNC.md** (§ "Our chat service isn't responding") and **lib/n8n.ts** (fallback comment and `generateSmartFallback`).
