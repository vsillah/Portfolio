# Chatbot Template

AI chatbot with n8n RAG integration and optional voice chat (VAPI).

## Features

- Text chat interface with typing indicators
- Conversation history persistence (Supabase)
- n8n webhook integration for AI responses
- Cross-channel context sharing (text + voice)
- Optional voice chat via VAPI
- Customizable suggested actions
- Dynamic system prompts (database-backed)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

- **Supabase**: Create a project at [supabase.com](https://supabase.com)
- **n8n**: Set up your chat workflow (see below)
- **VAPI** (optional): Get credentials from [vapi.ai](https://vapi.ai)

### 3. Set Up Database

Run the SQL files in your Supabase SQL editor:

1. `database/schema.sql` - Creates tables
2. `database/seed.sql` - Adds default prompts

### 4. Create n8n Workflow

Create a workflow with:

1. **Webhook Trigger** (POST method)
2. **AI Agent** or **OpenAI Chat** node
3. **Response** formatting

Expected webhook payload:
```json
{
  "action": "sendMessage",
  "sessionId": "chat_xxx_yyy",
  "chatInput": "User's message",
  "history": [...],
  "conversationSummary": "...",
  "visitorEmail": "...",
  "visitorName": "..."
}
```

Expected response:
```json
{
  "response": "AI response text",
  "escalated": false,
  "metadata": {}
}
```

### 5. Run Development Server

```bash
npm run dev
```

## Usage

### Basic Chat Component

```tsx
import { Chat } from '@/components/chat/Chat'

export default function Page() {
  return (
    <Chat
      initialMessage="Hi! How can I help you today?"
      suggestedActions={[
        { id: 'help', label: 'Get Help', message: 'I need help' },
        { id: 'pricing', label: 'Pricing', message: 'What are your prices?' },
      ]}
    />
  )
}
```

### With Visitor Info

```tsx
<Chat
  visitorEmail={user?.email}
  visitorName={user?.name}
  initialMessage="Welcome back! How can I assist you?"
/>
```

## Customization

### Styling

The components use Tailwind CSS. Modify the class names in:
- `components/chat/Chat.tsx`
- `components/chat/ChatMessage.tsx`
- `components/chat/ChatInput.tsx`

### System Prompts

Update prompts in the database (`system_prompts` table) or modify defaults in:
- `lib/system-prompts.ts`

### Voice Chat

To enable voice chat:
1. Set `NEXT_PUBLIC_VAPI_PUBLIC_KEY` and `NEXT_PUBLIC_VAPI_ASSISTANT_ID`
2. Create a VAPI assistant at [vapi.ai](https://vapi.ai)
3. Configure the assistant to use your n8n webhook

To disable voice chat:
- Leave VAPI environment variables empty
- Delete `lib/vapi.ts` and `components/chat/VoiceChat.tsx`

## File Structure

```
chatbot-template/
├── app/
│   └── api/chat/
│       ├── route.ts          # Main chat endpoint
│       ├── history/route.ts  # Get/delete history
│       └── context/route.ts  # Get context for RAG
├── components/chat/
│   ├── Chat.tsx              # Main chat component
│   ├── ChatMessage.tsx       # Message display
│   ├── ChatInput.tsx         # Text input
│   └── VoiceChat.tsx         # Voice chat (optional)
├── lib/
│   ├── supabase.ts           # Database client
│   ├── n8n.ts                # Webhook integration
│   ├── chat-context.ts       # Context fetching
│   ├── chat-utils.ts         # Client utilities
│   ├── system-prompts.ts     # Prompt management
│   ├── vapi.ts               # Voice chat (optional)
│   └── utils.ts              # Tailwind utilities
├── database/
│   ├── schema.sql            # Database tables
│   └── seed.sql              # Default data
├── .env.example
├── package.json
└── README.md
```

## n8n Workflow Tips

### Simple Chat Workflow

```
Webhook → OpenAI Chat → Respond to Webhook
```

### RAG-Enabled Workflow

```
Webhook → Vector Store Retrieval → AI Agent → Respond to Webhook
```

### Context Injection

The webhook payload includes:
- `history`: Last 20 messages
- `conversationSummary`: Summary of older messages
- `hasCrossChannelHistory`: True if both text and voice used

Use these in your AI Agent's system message for context-aware responses.

## License

MIT
