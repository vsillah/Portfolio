# n8n Chat Integration Setup Guide

This document explains how to set up the n8n-powered chat feature for your portfolio.

## Prerequisites

- A self-hosted n8n instance (or n8n Cloud)
- Access to your Supabase dashboard
- Environment variables configured

## Step 1: Database Setup

Run the SQL schema in your Supabase SQL editor:

```bash
# The schema file is located at:
database_schema_chat.sql
```

This creates two tables:
- `chat_sessions` - Tracks conversation sessions
- `chat_messages` - Stores individual messages

## Step 2: Environment Variables

Add the following to your `.env.local` file:

```env
# n8n Webhook URL
# Replace with your actual n8n webhook URL
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-workflow-id
```

For production (Vercel), add this environment variable in your Vercel project settings.

## Step 3: n8n Workflow Setup

Your n8n workflow should be configured as follows:

### 1. Webhook Trigger Node

Create a **Webhook** node as your trigger:

- **HTTP Method**: POST
- **Path**: Choose a unique path (e.g., `/portfolio-chat`)
- **Response Mode**: "Last Node" (to return the AI response)

The webhook will receive:

```json
{
  "message": "User's message text",
  "sessionId": "chat_abc123_xyz789",
  "history": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ],
  "visitorEmail": "visitor@example.com",
  "visitorName": "John Doe",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. AI Processing Node

Add your preferred AI node:

**Option A: OpenAI Node**
- Model: GPT-4 or GPT-3.5-turbo
- System prompt example:

```
You are a helpful assistant for Vambah Sillah's portfolio website. 
You help visitors learn about his projects, publications, music, and services.
Be friendly, professional, and helpful.

If someone wants to:
- Schedule a meeting, provide the contact form option
- Report issues, escalate to human support
- Make a purchase inquiry, help them navigate to the store

Always be concise and helpful.
```

**Option B: Anthropic/Claude Node**
- Similar configuration with Claude model

### 3. Conditional Node (Optional - for Escalation)

Add a condition to detect escalation triggers:

```javascript
// Check if user wants human support
const message = $json.message.toLowerCase();
const escalationTriggers = [
  'speak to human',
  'human support',
  'real person',
  'talk to someone',
  'customer service'
];

return escalationTriggers.some(trigger => message.includes(trigger));
```

### 4. Response Node

The final node should return JSON in this format:

```json
{
  "response": "The AI's response text",
  "escalated": false,
  "metadata": {
    "confidence": 0.95,
    "suggestedActions": ["view_projects", "contact_form"]
  }
}
```

## Example n8n Workflow

```
[Webhook] → [OpenAI] → [Set Response Format] → [Respond to Webhook]
                ↓
         [Check Escalation] → [Human Notification] → [Escalated Response]
```

### Simple Workflow (No Escalation)

1. **Webhook** (trigger)
2. **OpenAI** (process message with history context)
3. **Set** node to format response:
   ```javascript
   {
     "response": $json.choices[0].message.content,
     "escalated": false,
     "metadata": {}
   }
   ```

### Advanced Workflow (With Escalation)

1. **Webhook** (trigger)
2. **IF** node (check for escalation keywords)
3. **True branch**: 
   - Send email/Slack notification
   - Return escalated response
4. **False branch**:
   - **OpenAI** node
   - Format and return response

## Step 4: Testing

1. Start your local development server:
   ```bash
   npm run dev
   ```

2. Navigate to the Contact section

3. Click "Chat Now" tab

4. Send a test message

5. Check n8n execution logs if issues occur

## Troubleshooting

### Chat shows "service not configured"

- Verify `N8N_WEBHOOK_URL` is set in your environment
- Restart your Next.js server after adding env vars

### Messages not sending

- Check n8n workflow is active (not paused)
- Verify webhook URL is accessible from your server
- Check n8n execution logs for errors

### Database errors

- Ensure Supabase tables are created
- Check RLS policies are applied
- Verify `SUPABASE_SERVICE_KEY` is set (for admin access)

### Responses are slow

- Consider using streaming (requires workflow updates)
- Check n8n server performance
- Optimize AI model selection (GPT-3.5-turbo is faster than GPT-4)

## Security Considerations

1. **Rate Limiting**: Consider adding rate limiting to the `/api/chat` endpoint
2. **Input Validation**: Messages are sanitized before sending to n8n
3. **Session Management**: Sessions are stored client-side in localStorage
4. **Data Retention**: Consider adding a cleanup job for old chat sessions

## Customization

### Change Welcome Message

Edit `components/chat/Chat.tsx`:

```typescript
const welcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Your custom welcome message here",
  // ...
}
```

### Modify Chat Styling

The chat uses the portfolio's design system:
- `glass-card` - Background styling
- `radiant-gold` - Accent colors
- `platinum-white` - Text colors

Edit `components/chat/ChatMessage.tsx` and `components/chat/Chat.tsx` for custom styling.

### Add File Uploads

To support file uploads, you would need to:
1. Add a file input to `ChatInput.tsx`
2. Upload files to Supabase Storage
3. Include file URLs in the message payload to n8n

## Production Checklist

- [ ] Database schema applied to production Supabase
- [ ] `N8N_WEBHOOK_URL` set in Vercel environment variables
- [ ] n8n workflow tested and activated
- [ ] Error handling and fallback messages configured
- [ ] Chat analytics tracking (optional)
