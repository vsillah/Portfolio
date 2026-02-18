# Chat Evaluation Template

LLM-as-a-Judge evaluation system for chat conversations with human annotation and alignment tracking.

## Features

- Human annotation interface (good/bad ratings)
- LLM-as-a-Judge automated evaluations
- Multiple model support (Claude, GPT-4)
- Human-LLM alignment tracking
- Category-based issue classification
- Open coding for new issue types
- Confidence scoring

## Prerequisites

This template requires chat data to evaluate. It expects:
- `chat_sessions` table
- `chat_messages` table

You can either:
1. Use alongside the chatbot-template (same Supabase project)
2. Connect to an existing chat database
3. Import chat data from another source

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Add your:
- Supabase credentials
- Anthropic API key (for Claude)
- OpenAI API key (optional, for model comparison)

### 3. Set Up Database

Run `database/schema.sql` in your Supabase SQL editor.

**Note:** If chat tables don't exist, create them first from chatbot-template.

### 4. Run Development Server

```bash
npm run dev
```

## Usage

### LLM Judge Evaluation

```typescript
import { evaluateConversation, DEFAULT_JUDGE_CONFIG } from '@/lib/llm-judge'

const messages = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi! How can I help?' },
]

const context = {
  channel: 'text',
  totalMessages: 2,
}

const evaluation = await evaluateConversation(messages, context)
// { rating: 'good', reasoning: '...', confidence: 0.9, categories: [] }
```

### Batch Evaluation

```typescript
import { batchEvaluateConversations } from '@/lib/llm-judge'

const results = await batchEvaluateConversations([
  { sessionId: '1', messages: [...], context: {...} },
  { sessionId: '2', messages: [...], context: {...} },
])
```

### Calculate Alignment

```typescript
import { calculateAlignment } from '@/lib/llm-judge'

const alignment = calculateAlignment([
  { humanRating: 'good', llmRating: 'good' },
  { humanRating: 'bad', llmRating: 'bad' },
  { humanRating: 'good', llmRating: 'bad' },
])
// { alignmentRate: 66, breakdown: {...} }
```

## Available Models

### Anthropic (Claude)
- `claude-sonnet-4-20250514` - Best balance (default)
- `claude-3-5-haiku-20241022` - Fast and cheap

### OpenAI
- `gpt-4o` - Most capable
- `gpt-4o-mini` - Fast and cheap

## Evaluation Criteria

The LLM judge evaluates conversations on:

1. **Response Accuracy** - Factual correctness
2. **Helpfulness** - Addressing user needs
3. **Tone & Professionalism** - Appropriate communication
4. **Tool Usage** - Correct function calls
5. **Edge Case Handling** - Graceful error handling
6. **Escalation Appropriateness** - Warranted handoffs

## Default Categories

- Transfer/handoff issues
- Incorrect information provided
- Follow-up capability issues
- Tone or communication issues
- Tool usage errors
- Markdown or formatting errors
- Failed to answer question
- System prompt violation

## File Structure

```
eval-template/
├── app/
│   └── api/
│       └── admin/
│           ├── chat-eval/
│           └── llm-judge/
├── lib/
│   ├── supabase.ts
│   ├── llm-judge.ts
│   └── utils.ts
├── database/
│   └── schema.sql
├── .env.example
├── package.json
└── README.md
```

## Customization

### Evaluation Criteria

Modify the `EVALUATION_CRITERIA` constant in `lib/llm-judge.ts` to customize what the LLM evaluates.

### Categories

Add/modify categories in `database/schema.sql` or via the admin interface.

### Model Configuration

```typescript
const customConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.2,
  promptVersion: 'v2',
}

await evaluateConversation(messages, context, customConfig)
```

## License

MIT
