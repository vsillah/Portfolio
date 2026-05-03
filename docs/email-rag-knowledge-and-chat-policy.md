# Email generation: Pinecone RAG and site chat context

## Policy (implemented)

1. **Pinecone / knowledge base (RAG)**  
   In-app email drafts (outreach queue + delivery email) call the same n8n webhook as WF-SOC-001 and WF-MCH: `POST` to `N8N_RAG_QUERY_WEBHOOK_URL` or, by default, `{N8N_BASE_URL}/webhook/amadutown-rag-query` with body `{ "query": "…" }`. The workflow performs vector retrieval (Pinecone) and returns text that is appended to the system prompt under **“Relevant experience (from your knowledge base / Pinecone via RAG)”**.  
   If the webhook fails or outbound n8n is disabled, the email is still generated without that block (graceful degradation).

2. **LLM chat history**  
   **We do not** automatically embed `chat_messages` into Pinecone.  
   **Optional prompt-only path:** when `EMAIL_RAG_INCLUDE_SITE_CHAT=true`, the app loads the most recent `chat_sessions` row whose `visitor_email` matches the lead’s email (case-insensitive) and appends the last up to 16 messages (capped in size) under **“Prior site chat with this email address”**. This is off by default for privacy; enable when you are comfortable matching site visitors to leads by email.

3. **Disabling RAG for email only**  
   Set `EMAIL_RAG_ENABLED=false` to skip the RAG call while still allowing `GET /api/admin/rag-health` to probe the webhook (it uses `ignoreEmailRagEnabled` internally).

## Operations

- **Health check (admin):** `GET /api/admin/rag-health` (optional `?q=` custom query). Confirms the app can reach the RAG webhook and return non-empty text. Still respects `MOCK_N8N` and `N8N_DISABLE_OUTBOUND`.
- **n8n:** The workflow exposing `amadutown-rag-query` must be **active** and the Pinecone node must have valid credentials (see `docs/staging-n8n-activation-matrix.md` for historical staging notes).
- **Local chatbot knowledge:** `GET /api/knowledge` and `GET /api/knowledge/chatbot` now include `docs/vambah-personality-public-safe.md`, a public-safe personality corpus summary generated from the governed local corpus. This improves the website chatbot's local knowledge bundle without mutating Pinecone.
- **Pinecone status:** personality-corpus Pinecone ingestion remains deferred. Ingest only after reviewing the staged corpus pack and deciding whether the Pinecone-backed n8n workflow should treat it as a canonical source.

## Code entry points

- [`lib/rag-query.ts`](../lib/rag-query.ts) — HTTP client and query string builder.  
- [`lib/chatbot-knowledge.ts`](../lib/chatbot-knowledge.ts) — Local `/api/knowledge` source registry, including the public-safe personality corpus document.
- [`lib/email-llm-context.ts`](../lib/email-llm-context.ts) — Appends RAG + optional chat blocks to the system prompt.  
- [`lib/lead-chat-excerpt.ts`](../lib/lead-chat-excerpt.ts) — Optional site chat transcript.  
- [`lib/outreach-queue-generator.ts`](../lib/outreach-queue-generator.ts), [`lib/delivery-email.ts`](../lib/delivery-email.ts) — Call the appender after template placeholders are resolved.
