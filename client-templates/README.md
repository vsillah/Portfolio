# Client Templates

Reusable templates for client projects, extracted from the portfolio codebase.

## Overview

```
client-templates/
├── shared/                 # Common utilities
├── chatbot-template/       # AI Chatbot with n8n RAG
├── leadgen-template/       # Lead generation system
├── eval-template/          # Chat evaluation system
└── diagnostic-template/    # Diagnostic (audit) flow for sales
```

## Templates

### Chatbot Template

AI-powered chatbot with n8n integration for RAG (Retrieval Augmented Generation).

**Features:**
- Text chat interface with typing indicators
- Optional voice chat via VAPI
- Conversation history persistence
- n8n webhook integration for AI processing
- Cross-channel context sharing
- Dynamic system prompts

**Use when:** Client needs an AI assistant on their website.

### Lead Generation Template

Complete lead capture and qualification system.

**Features:**
- Contact form with customizable fields
- Lead magnet delivery with tracking
- Exit intent popup
- n8n webhook for lead enrichment
- Diagnostic assessments
- Sales session tracking

**Use when:** Client needs to capture and qualify leads.

### Eval Template

Chat evaluation system for quality assessment.

**Features:**
- Human annotation interface
- LLM-as-a-Judge automated evaluations
- Multiple model support (Claude, GPT-4)
- Human-LLM alignment tracking
- Category-based issue classification

**Use when:** Client needs to monitor and improve AI chat quality.

### Diagnostic Template

Client-facing diagnostic (audit) flow that routes to sales.

**Features:**
- Diagnostic conversation with structured questions
- Audit storage and completion webhook
- Link to sales session / proposal path
- Optional n8n post-completion actions

**Use when:** Client needs a discovery/audit flow that feeds into proposals.

## Quick Start

### 1. Choose Your Template(s)

Copy the template folder(s) you need:

```bash
cp -r chatbot-template /path/to/new-project
```

### 2. Add Shared Utilities (Optional)

If you need authentication or additional utilities:

```bash
cd shared
./copy-shared.sh /path/to/new-project
```

### 3. Install Dependencies

```bash
cd /path/to/new-project
npm install
```

### 4. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

### 5. Set Up Database

Run the SQL files from `database/` in your Supabase SQL editor.

### 6. Start Development

```bash
npm run dev
```

## Combining Templates

Templates can be combined in the same project:

1. **Chatbot + Leadgen**: AI chat that captures leads
2. **Chatbot + Eval**: AI chat with quality monitoring
3. **All Three**: Full-featured client solution

When combining:
1. Use a single Supabase project
2. Run all schema files (they're designed to coexist)
3. Merge the `lib/` folders (handle duplicates like `supabase.ts`)
4. Combine API routes in a single `app/api/` structure

## Shared Utilities

The `shared/` folder contains common utilities:

- **supabase.ts** - Supabase client setup
- **auth.ts** - Client-side authentication
- **auth-server.ts** - Server-side auth verification
- **utils.ts** - Tailwind CSS utilities
- **database/schema_auth.sql** - User profiles table

## n8n Workflows

Each template that uses n8n includes documentation on the expected webhook format. You'll need to:

1. Set up your n8n instance
2. Create workflows that match the expected payload/response format
3. Add webhook URLs to your environment variables

### Expected Workflow Patterns

**Chatbot:**
```
Webhook → AI Agent (with RAG) → Response
```

**Lead Generation:**
```
Webhook → Company Enrichment → Lead Scoring → Update DB → Notify
```

**Diagnostic:**
```
Webhook → Process Diagnostic → Update DB → Notify Sales
```

## Customization

### Styling

All templates use Tailwind CSS. Customize colors/styles by modifying:
- Component class names
- `tailwind.config.ts`
- `globals.css`

### System Prompts

The chatbot template supports database-backed prompts via the `system_prompts` table. Modify:
- `lib/system-prompts.ts` for defaults
- Database records for runtime changes

### Evaluation Criteria

Modify LLM judge behavior in:
- `lib/llm-judge.ts` - Evaluation criteria
- `database/schema.sql` - Categories

## Requirements

- Node.js 18+
- Supabase account
- n8n instance (for chatbot/leadgen)
- Anthropic/OpenAI API key (for eval)
- VAPI account (optional, for voice chat)

## License

MIT
