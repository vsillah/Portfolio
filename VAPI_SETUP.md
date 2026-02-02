# VAPI Voice Chat Setup Guide

This guide explains how to configure VAPI voice chat for your portfolio site.

## Overview

VAPI enables voice conversations with your AI assistant directly in the browser. The integration shares the same N8N backend as your text chat, providing a unified experience.

## Prerequisites

1. A VAPI account at [vapi.ai](https://vapi.ai)
2. Your N8N workflows already configured for text chat

## Step 1: Get VAPI Credentials

1. Go to the [VAPI Dashboard](https://dashboard.vapi.ai)
2. Navigate to **Settings** > **API Keys**
3. Copy your **Public Key** (starts with `pk_`)
4. Copy your **Private Key** (starts with `sk_`) - needed for server-side operations

## Step 2: Create a VAPI Assistant

1. In the VAPI Dashboard, go to **Assistants**
2. Click **Create Assistant**
3. Configure your assistant:

### Basic Settings
- **Name**: Portfolio Voice Assistant
- **First Message**: "Hi! I'm Vambah's AI assistant. How can I help you today?"

### Model Configuration
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "temperature": 0.7,
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful voice assistant for Vambah's portfolio. You help visitors learn about projects, services, and can assist with business diagnostic assessments. Keep responses concise and conversational since this is a voice interface."
    }
  ]
}
```

### Voice Configuration
- **Provider**: 11labs (recommended) or OpenAI
- **Voice**: Choose a voice that matches your brand

### Server URL (Webhook)
Set your server URL to receive function calls and transcripts:
```
https://your-domain.com/api/vapi/webhook
```

## Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```env
# VAPI Configuration
NEXT_PUBLIC_VAPI_PUBLIC_KEY=pk_your_public_key_here
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your_assistant_id_here
VAPI_PRIVATE_KEY=sk_your_private_key_here
```

### Where to find your Assistant ID
1. Go to VAPI Dashboard > Assistants
2. Click on your assistant
3. The URL will show the ID: `https://dashboard.vapi.ai/assistants/YOUR_ASSISTANT_ID`

## Step 4: Configure VAPI Tools (Optional)

To enable function calling from your voice assistant, add tools in the VAPI assistant configuration:

### Example Tools

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "startDiagnostic",
        "description": "Start a business diagnostic assessment",
        "parameters": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "getProjectInfo",
        "description": "Get information about a specific project",
        "parameters": {
          "type": "object",
          "properties": {
            "projectName": {
              "type": "string",
              "description": "Name of the project to get info about"
            }
          },
          "required": []
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "scheduleCallback",
        "description": "Schedule a callback with the team",
        "parameters": {
          "type": "object",
          "properties": {
            "preferredTime": {
              "type": "string",
              "description": "Preferred time for the callback"
            }
          },
          "required": ["preferredTime"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "transferToHuman",
        "description": "Transfer the conversation to a human team member",
        "parameters": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    }
  ]
}
```

## Step 5: Test Your Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open your portfolio site
3. Expand the chat widget
4. Click the microphone icon to switch to voice mode
5. Click "Start Voice Call" to begin

## Architecture

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser       │────▶│    VAPI     │────▶│  Webhook    │
│   (Web SDK)     │◀────│   Platform  │◀────│  /api/vapi  │
└─────────────────┘     └─────────────┘     └──────┬──────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │    N8N      │
                                            │  Workflows  │
                                            └──────┬──────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │  Supabase   │
                                            │   Database  │
                                            └─────────────┘
```

## Webhook Events

The `/api/vapi/webhook` route handles these events:

| Event | Description |
|-------|-------------|
| `status-update` | Call status changes (ringing, in-progress, ended) |
| `transcript` | User speech transcripts (partial and final) |
| `function-call` | Tool/function invocations from the assistant |
| `end-of-call-report` | Summary and recording after call ends |

## Troubleshooting

### Voice button not showing
- Check that `NEXT_PUBLIC_VAPI_PUBLIC_KEY` and `NEXT_PUBLIC_VAPI_ASSISTANT_ID` are set
- Restart the dev server after adding environment variables

### Call fails to start
- Ensure browser has microphone permissions
- Check browser console for errors
- Verify your VAPI public key is correct

### No response from assistant
- Check the webhook URL is correctly configured in VAPI
- Verify your N8N workflow is active
- Check server logs for webhook errors

### Audio quality issues
- Use headphones to prevent echo
- Ensure stable internet connection
- Try a different browser (Chrome recommended)

## N8N Workflow Updates

To differentiate voice vs text messages in your N8N workflow, check the `source` field in the payload:

```javascript
// In N8N Code node
const source = $json.source || 'text';

if (source === 'voice') {
  // Adjust response for voice (shorter, more conversational)
  return {
    response: shortenForVoice(response)
  };
}
```

## Security Notes

- Never expose `VAPI_PRIVATE_KEY` to the client
- The public key (`NEXT_PUBLIC_VAPI_PUBLIC_KEY`) is safe to expose
- Consider rate limiting the webhook endpoint in production
- Validate webhook signatures in production (see VAPI docs)
