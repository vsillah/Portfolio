# n8n Prompt Sync Setup Guide

This guide explains how your n8n workflows dynamically fetch AI agent prompts from the portfolio dashboard.

## Overview

The portfolio dashboard provides a public API endpoint that n8n workflows use to fetch the latest system prompts. When you update a prompt in the `/admin/prompts` dashboard, it's immediately available to your n8n workflows.

## What Was Configured

### 1. New Nodes Added to "RAG Chatbot for AmaduTown using Google Gemini"

Two new nodes were added to your workflow:

- **Fetch Dynamic Prompt** - HTTP Request node that fetches the prompt from your portfolio API
- **Merge Prompt Data** - Set node that combines the fetched prompt with existing workflow data

### 2. Updated Flow

```
[When chat message received]
        ↓
[Process External History]
        ↓
[Fetch Dynamic Prompt] ← NEW: Fetches prompt from /api/prompts/chatbot
        ↓
[Merge Prompt Data] ← NEW: Merges prompt into workflow data
        ↓
[If] / [Check Diagnostic Mode]
        ↓
[AI Agent] ← Now uses $json.dynamicSystemPrompt
```

### 3. AI Agent System Message

The AI Agent now uses the dynamically fetched prompt:

```
{{ $json.dynamicSystemPrompt || 'You are a helpful assistant...' }}
```

If the API is unavailable, it falls back to the default prompt.

## API Endpoint

**Public Endpoint:** `GET /api/prompts/[key]`

- **URL**: `https://amadutown.com/api/prompts/chatbot`
- **Authentication**: None required (public endpoint)
- **Returns**: Only active prompts (`is_active = true`)

### Response Format

```json
{
  "prompt": {
    "id": "uuid",
    "key": "chatbot",
    "name": "Portfolio Chatbot",
    "prompt": "You are an AI assistant...",
    "config": {
      "temperature": 0.7,
      "maxTokens": 1000
    },
    "version": 1
  }
}
```

### Available Prompt Keys

- `chatbot` - Main portfolio chatbot prompt
- `voice_agent` - Voice agent prompt
- `llm_judge` - LLM-as-Judge evaluation prompt
- `diagnostic` - Diagnostic agent prompt

## Environment Variable (Optional)

You can set the `PORTFOLIO_URL` environment variable in n8n to configure the base URL:

```
PORTFOLIO_URL=https://amadutown.com
```

The HTTP Request node uses:
```
{{ $env.PORTFOLIO_URL || 'https://amadutown.com' }}/api/prompts/chatbot
```

## Cache Clearing

When you update a prompt in the admin dashboard, the server-side cache is automatically cleared. This ensures n8n always fetches the latest prompt version.

## Error Handling

The "Fetch Dynamic Prompt" node has `onError: continueRegularOutput` configured, meaning:
- If the API is unavailable, the workflow continues without crashing
- The AI Agent falls back to its default prompt

## Testing

1. **Update a prompt** in the `/admin/prompts` dashboard
2. **Trigger the chatbot** by sending a message
3. **Verify** the AI Agent uses the new prompt by checking its responses

## Troubleshooting

### Prompt not updating

1. Check that the prompt is marked as **active** in the dashboard
2. Verify the correct prompt key is used (`chatbot`)
3. Test the API directly: `curl https://amadutown.com/api/prompts/chatbot`

### 404 Error

- The prompt key doesn't exist or is inactive
- Check the dashboard to ensure the prompt is active

### Network Errors

- Verify your n8n instance can reach amadutown.com
- Check for firewall restrictions

### "Our chat service isn't responding" (fallback message)

When the user sees this message, the **Next.js app could not get a successful response from n8n**. The flow is:

1. User sends a message → the app POSTs to **N8N_WEBHOOK_URL** (your RAG Chatbot webhook).
2. The n8n workflow runs: it fetches the dynamic prompt, **then fetches the knowledge base** from `GET /api/knowledge` (or `/api/knowledge/chatbot`), then runs the AI Agent.
3. If step 1 fails (no webhook URL, timeout, 404, 502, etc.), the app never reaches n8n—so the knowledge base is never called. The user sees the fallback and is offered the contact form and discovery call link.

**How to debug:**

- **App (Railway/Vercel):** Set **N8N_WEBHOOK_URL** to the full webhook URL of "RAG Chatbot for AmaduTown" (e.g. `https://n8n.amadutown.com/webhook/...`). Check server logs for `[n8n] All attempts failed` and `fallbackReason` (e.g. "N8N_WEBHOOK_URL not configured", "n8n request timed out", "n8n workflow not found (404)").
- **n8n:** Ensure the workflow is **active** and the webhook is reachable (e.g. `curl -X POST <webhook_url> -H "Content-Type: application/json" -d '{"action":"sendMessage","sessionId":"test","chatInput":"hi"}'`). If n8n is behind a tunnel, ensure the tunnel is up and the app can reach it (no 502).
- **Knowledge base:** Only used *inside* the workflow. If the app can’t reach n8n, the knowledge fetch never runs. Once n8n is reachable, verify the "Fetch Knowledge" node returns 200 and that `dynamicKnowledge` is passed into the AI Agent system message.

## Chatbot Knowledge Endpoint

The homepage chatbot can also fetch **latest documentation** from the repo so its answers stay aligned with the website and process.

**Public Endpoint:** `GET /api/knowledge/chatbot`

- **URL**: `https://amadutown.com/api/knowledge/chatbot` (use this exact URL in n8n; do not use `$env` in nodes—see project rules)
- **Authentication**: None required
- **Returns**: Plain text (UTF-8) — concatenated markdown from curated docs: user-help guide, admin/sales SOP overview, README

### Adding Knowledge to the RAG Chatbot Workflow

1. In "RAG Chatbot for AmaduTown using Google Gemini", after **Fetch Dynamic Prompt** (or in parallel with it), add an **HTTP Request** node:
   - **Method**: GET
   - **URL**: `https://amadutown.com/api/knowledge/chatbot` (hardcode production base URL, or use a Credential that stores the base URL—do not use `$env` expressions)
2. Add a **Set** or **Merge** node that adds the response body to workflow data, e.g. as `dynamicKnowledge` (so the next node can use `{{ $json.dynamicKnowledge }}`).
3. In the **AI Agent** system message, include the knowledge after the prompt, e.g.:
   ```
   {{ $json.dynamicSystemPrompt || 'You are a helpful assistant...' }}

   Use the following knowledge when answering visitor questions (this is the latest site and process documentation):

   {{ $json.dynamicKnowledge }}
   ```
4. Configure the knowledge HTTP Request node with `onError: continueRegularOutput` so if the knowledge API is unavailable, the workflow still runs with the system prompt only.
5. Ensure combined prompt + knowledge length stays within your AI model’s context limit (current doc set is within Gemini limits).

### Curated Sources

The knowledge API reads from the repo at request time. Sources are configured in `lib/chatbot-knowledge.ts` (paths relative to project root). When you update those docs and deploy, the chatbot gets the new content on the next request—no separate "chatbot guide" to maintain.

## Related Documentation

- See `N8N_CHAT_SETUP.md` for general n8n integration setup
- Visit `/admin/prompts` to manage system prompts
- See `lib/chatbot-knowledge.ts` to add or remove docs included in `/api/knowledge/chatbot`
