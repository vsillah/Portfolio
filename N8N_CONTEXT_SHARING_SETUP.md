# N8N Context Sharing Setup for Voice + Text Chat

This guide explains how to configure your N8N workflow to use the external conversation history injected from Supabase, enabling seamless context sharing between text chat and VAPI voice chat.

## Overview

The portfolio now sends conversation history with every N8N request, enabling:
- **Cross-channel continuity**: Voice and text share the same conversation context
- **Session persistence**: N8N receives context even after workflow restarts
- **Rich context**: History includes message source (text/voice), timestamps, and summaries

## Payload Structure

Your N8N webhook now receives this enhanced payload:

```json
{
  "action": "sendMessage",
  "sessionId": "chat_abc123_xyz789",
  "chatInput": "User's current message",
  "source": "text",
  "history": [
    {
      "role": "user",
      "content": "Previous user message",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "source": "text"
    },
    {
      "role": "assistant", 
      "content": "Previous AI response",
      "timestamp": "2024-01-15T10:30:05.000Z",
      "source": "text"
    },
    {
      "role": "user",
      "content": "Voice message from same session",
      "timestamp": "2024-01-15T10:31:00.000Z",
      "source": "voice"
    }
  ],
  "conversationSummary": "Topics discussed include: projects, services. Total of 25 earlier messages.",
  "hasCrossChannelHistory": true,
  "visitorEmail": "visitor@example.com",
  "visitorName": "John Doe",
  "diagnosticMode": false
}
```

### New Fields

| Field | Type | Description |
|-------|------|-------------|
| `source` | `"text"` \| `"voice"` | Channel the current message came from |
| `history` | `Array` | Last 20 messages with role, content, timestamp, source |
| `conversationSummary` | `string` | Summary of older messages (if >20 total) |
| `hasCrossChannelHistory` | `boolean` | True if session has both text and voice messages |

## N8N Workflow Updates

### Option 1: Use External History Directly (Recommended)

Replace or augment your Simple Memory node with the external history.

#### Step 1: Add a Code Node After Webhook

Add a **Code** node to format the history for your AI agent:

```javascript
// Format external history for AI agent
const history = $json.history || [];
const summary = $json.conversationSummary || '';
const source = $json.source || 'text';
const hasCrossChannel = $json.hasCrossChannelHistory || false;

// Build context message for the AI
let contextPrefix = '';

if (hasCrossChannel) {
  contextPrefix = '[Note: This conversation has occurred across both text and voice channels. Maintain context continuity.]\n\n';
}

if (summary) {
  contextPrefix += `[Earlier conversation summary: ${summary}]\n\n`;
}

// Format history as chat messages
const formattedHistory = history.map(msg => ({
  role: msg.role === 'user' ? 'user' : 'assistant',
  content: msg.content
}));

return {
  chatInput: $json.chatInput,
  sessionId: $json.sessionId,
  formattedHistory,
  contextPrefix,
  source,
  hasCrossChannel,
  visitorEmail: $json.visitorEmail,
  visitorName: $json.visitorName
};
```

#### Step 2: Configure AI Agent Node

In your **OpenAI** or **AI Agent** node, use the formatted history:

**System Prompt Enhancement:**
```
You are a helpful assistant for Vambah's portfolio website.

{{ $json.contextPrefix }}

Current channel: {{ $json.source }}
{% if $json.hasCrossChannel %}
The visitor has used both text and voice to communicate. Ensure your responses are appropriate for the current channel ({{ $json.source }}).
{% endif %}
```

**Messages/History Input:**
Use the `formattedHistory` output from the Code node as the conversation history input.

### Option 2: Merge with Simple Memory

If you want to keep using Simple Memory alongside external history:

```javascript
// Code node: Merge external and internal history
const externalHistory = $json.history || [];
const internalMessages = $('Window Buffer Memory').item.json.messages || [];

// Deduplicate by content (in case of overlap)
const seen = new Set();
const combined = [];

// Add external history first (older)
for (const msg of externalHistory) {
  const key = `${msg.role}:${msg.content.substring(0, 50)}`;
  if (!seen.has(key)) {
    seen.add(key);
    combined.push(msg);
  }
}

// Add internal memory (potentially more recent)
for (const msg of internalMessages) {
  const key = `${msg.role}:${msg.content.substring(0, 50)}`;
  if (!seen.has(key)) {
    seen.add(key);
    combined.push(msg);
  }
}

// Sort by timestamp
combined.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

// Keep last 20 messages
const recentHistory = combined.slice(-20);

return { 
  mergedHistory: recentHistory,
  chatInput: $json.chatInput,
  sessionId: $json.sessionId
};
```

### Option 3: Channel-Aware Responses

Adjust your response style based on the source channel:

```javascript
// Code node: Adjust response for channel
const source = $json.source;
const aiResponse = $('OpenAI').item.json.text;

let finalResponse = aiResponse;

if (source === 'voice') {
  // Shorten response for voice (aim for <100 words)
  // Remove markdown formatting
  // Use more conversational tone
  finalResponse = aiResponse
    .replace(/\*\*/g, '')  // Remove bold
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove links, keep text
    .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
    .split('. ')
    .slice(0, 3)
    .join('. ') + '.';
}

return { response: finalResponse };
```

## VAPI Custom LLM Configuration

To ensure VAPI uses the same AI agent as text chat (N8N), configure VAPI to route all AI responses through your webhook.

### Option A: Server URL for All Responses

1. Go to VAPI Dashboard > Your Assistant > Advanced Settings
2. Enable **Custom LLM**
3. Set the endpoint to your VAPI webhook URL
4. Configure the request format to match your webhook expectations

### Option B: Keep VAPI's LLM, Mirror System Prompt

If you prefer VAPI to handle its own AI responses:

1. Copy your N8N system prompt to VAPI's assistant configuration
2. Ensure the same model (GPT-4o, etc.) is used
3. Configure matching temperature and other parameters
4. Use VAPI tools for function calls that mirror your N8N logic

**VAPI System Prompt (mirror of N8N):**
```
You are a helpful assistant for Vambah Sillah's portfolio website. 
You help visitors learn about his projects, publications, music, and services.
Be friendly, professional, and helpful.

Since this is a voice conversation, keep your responses concise and conversational.
Aim for responses under 50 words unless more detail is specifically requested.

If someone wants to:
- Schedule a meeting, offer to note their preference
- Report issues, escalate to human support
- Make a purchase inquiry, help them navigate to the store
- Perform a diagnostic/audit, guide them through the assessment
```

## Testing Context Sharing

### Test 1: Text-to-Voice Continuity

1. Start a text chat conversation
2. Ask about projects
3. Switch to voice mode
4. Say "Tell me more about that project"
5. The AI should remember the text conversation context

### Test 2: Voice-to-Text Continuity

1. Start a voice call
2. Discuss services
3. End the call
4. Switch to text mode
5. Type "Can you summarize what we discussed?"
6. The AI should have context from the voice conversation

### Test 3: Check N8N Execution Logs

1. Trigger both text and voice messages
2. Check N8N execution logs
3. Verify the `history` array contains messages from both sources
4. Verify `hasCrossChannelHistory` is `true`

## Troubleshooting

### Context Not Appearing in N8N

- Check that the webhook is receiving the `history` field
- Verify the session ID matches between text and voice
- Check Supabase `chat_messages` table for stored messages

### Different AI Personalities

- Ensure the same system prompt is used in both N8N and VAPI
- Use the same AI model (GPT-4o recommended)
- Match temperature settings

### Session ID Mismatch

- Verify VoiceChat receives the sessionId prop from Chat.tsx
- Check browser console for the sessionId being passed to VAPI
- Check VAPI webhook logs for the received metadata

### History Too Long

- The system limits history to 20 messages by default
- For longer conversations, use the `conversationSummary` field
- Consider implementing conversation compression in N8N

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│  Chat.tsx                                                       │
│  ├── sessionId (shared)                                         │
│  ├── TextChat ─────────────► /api/chat                          │
│  │                              │                               │
│  └── VoiceChat ─────────────► VAPI ─────► /api/vapi/webhook     │
│        (sessionId in metadata)           │                      │
└─────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend APIs                             │
├─────────────────────────────────────────────────────────────────┤
│  /api/chat/context                                              │
│  └── Fetches history from Supabase                              │
│                                                                 │
│  /api/chat ──────────────┐                                      │
│  └── Injects history ────┼──► N8N Webhook                       │
│                          │    (unified payload)                 │
│  /api/vapi/webhook ──────┘                                      │
│  └── Injects history                                            │
└─────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         N8N Workflow                             │
├─────────────────────────────────────────────────────────────────┤
│  Webhook ──► Code (process history) ──► AI Agent ──► Response   │
│                                                                 │
│  Receives:                                                      │
│  - chatInput (current message)                                  │
│  - history (last 20 messages from all channels)                 │
│  - source (text/voice)                                          │
│  - conversationSummary (if long conversation)                   │
│  - hasCrossChannelHistory (boolean)                             │
└─────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
├─────────────────────────────────────────────────────────────────┤
│  chat_sessions                                                  │
│  └── session_id, visitor_info, metadata                         │
│                                                                 │
│  chat_messages                                                  │
│  └── session_id, role, content, metadata (includes source)      │
└─────────────────────────────────────────────────────────────────┘
```

## Summary

With these updates, your N8N workflow now receives:
1. **Full conversation history** from Supabase (not just in-memory)
2. **Channel information** to know if the message came from text or voice
3. **Cross-channel flag** to acknowledge when users switch between channels
4. **Conversation summary** for long sessions

This enables seamless handoffs between voice and text while maintaining a consistent AI experience.
