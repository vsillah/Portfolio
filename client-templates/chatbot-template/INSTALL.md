# Install Guide — Chatbot Template

## Prerequisites

- Node.js 18+
- Supabase project
- n8n instance (or n8n Cloud)
- OpenAI or Anthropic API key (via n8n or app)

## 1. Clone or copy

```bash
cp -r chatbot-template /path/to/your-project
cd /path/to/your-project
```

## 2. Install dependencies

```bash
npm install
```

## 3. Database

Run the SQL files in `database/` in your Supabase SQL editor (e.g. `schema_chat.sql`, schema for system prompts if used).

## 4. Environment variables

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `N8N_WEBHOOK_URL` — your n8n webhook URL for chat messages
- (Optional) `SUPABASE_SERVICE_ROLE_KEY` for server-side writes

## 5. n8n workflow

- Create a workflow with a Webhook trigger (POST).
- Connect to your AI node (OpenAI, Anthropic, or AI Agent with RAG).
- Use the payload format documented in the template README (message, sessionId, history).
- Set response mode to "Last Node" and return the assistant reply.

## 6. Run

```bash
npm run dev
```

Open the chat route and send a message. Confirm the webhook is called and responses return.

## 7. Deploy

Deploy to Vercel (or your host). Add the same env vars. Update n8n webhook URL if needed.

## Optional: voice (VAPI)

If using VAPI, add `VAPI_*` env vars and configure the voice agent to use the same n8n endpoint or your app API.
