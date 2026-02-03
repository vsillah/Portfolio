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

## Related Documentation

- See `N8N_CHAT_SETUP.md` for general n8n integration setup
- Visit `/admin/prompts` to manage system prompts
