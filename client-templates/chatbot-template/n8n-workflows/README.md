# n8n Workflow Setup

This folder contains a pre-built n8n workflow you can import directly.

## Quick Start

### 1. Open n8n

Go to your n8n instance (n8n Cloud at [app.n8n.cloud](https://app.n8n.cloud) or your self-hosted URL).

### 2. Import the workflow

1. Click **Add workflow** (or the `+` button)
2. Click the **three dots menu** (⋯) in the top right
3. Select **Import from file...**
4. Choose `simple-chat.json` from this folder

### 3. Add your OpenAI credentials

1. Click the **OpenAI Chat** node in the workflow
2. Under **Credential**, click **Create New**
3. Paste your OpenAI API key
4. Click **Save**

### 4. Activate the workflow

1. Toggle the **Active** switch in the top right to **ON**
2. Click the **Webhook** node
3. Copy the **Production URL** — this is your `N8N_WEBHOOK_URL`

### 5. Add the URL to your chatbot

Paste the webhook URL into your `.env.local`:

```
N8N_WEBHOOK_URL=https://your-n8n.app.n8n.cloud/webhook/xxxxx
```

Or re-run `npm run setup` and paste it when prompted.

## Workflow Structure

```
Webhook (POST) → OpenAI Chat → Respond to Webhook
```

The webhook receives:
- `chatInput` — the user's message
- `sessionId` — for conversation tracking
- `history` — recent messages for context

The workflow responds with the AI's reply, which your chatbot displays.

## Customization

### Change the AI model

Click the **OpenAI Chat** node and change the model (e.g., `gpt-4o`, `gpt-3.5-turbo`).

### Add RAG (knowledge base)

To make the chatbot answer questions about your business:

1. Add a **Vector Store** node between Webhook and OpenAI Chat
2. Upload your documents (PDFs, text files) to the vector store
3. Connect the retrieved context to the OpenAI Chat system message

### Use Anthropic instead of OpenAI

Replace the OpenAI Chat node with an **Anthropic** node and add your Anthropic API key.

## Troubleshooting

**Webhook returns 404**: The workflow is not active. Toggle it ON.

**Webhook returns 500**: Check the n8n execution log for errors (usually a missing API key).

**No response in chatbot**: Make sure the webhook URL in `.env.local` matches the Production URL (not the Test URL).
