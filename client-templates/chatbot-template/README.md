# AI Chatbot Template

An AI-powered chatbot for your website. Connects to your own AI backend via n8n, stores conversation history in Supabase, and optionally supports voice chat via VAPI.

**Built with:** Next.js 14, TypeScript, Tailwind CSS, Supabase, n8n

---

## What You Get

- Text chat with typing indicators and conversation history
- AI responses powered by your n8n workflow (OpenAI, Anthropic, or any LLM)
- Optional voice chat via VAPI
- Customizable branding, prompts, and features — all in simple config files
- One-click deploy to Vercel
- Automatic updates from the template author via Pull Requests

---

## Prerequisites

Before you start, create free accounts at:

1. **[Supabase](https://supabase.com)** — your database (free tier works)
2. **[n8n](https://n8n.io)** — your AI workflow engine (free tier works)
3. **[Node.js 18+](https://nodejs.org)** — to run the chatbot locally
4. *(Optional)* **[VAPI](https://vapi.ai)** — for voice chat

---

## Quick Start (5 steps)

### Step 1: Create your repo

Click the green **"Use this template"** button at the top of this page, then **"Create a new repository"**. Name it something like `my-company-chatbot`.

### Step 2: Clone it

**Option A — GitHub Desktop (easiest):**
Download [GitHub Desktop](https://desktop.github.com), sign in, and clone your new repo.

**Option B — Terminal:**
```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
cd YOUR-REPO-NAME
```

### Step 3: Run the setup wizard

```bash
npm run setup
```

The wizard will ask you for:
- Your business name
- Your Supabase project URL and keys
- Your n8n webhook URL

It creates your `.env.local` file and configures your branding automatically.

### Step 4: Set up the database

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Click **New query**
3. Copy the contents of `database/schema.sql` → click **Run**
4. Copy the contents of `database/seed.sql` → click **Run**

### Step 5: Start your chatbot

```bash
npm run doctor   # Verify everything is configured
npm run dev      # Start the chatbot
```

Open [http://localhost:3000](http://localhost:3000) — you should see your chatbot!

---

## Deploy to Production

Click the button below to deploy to Vercel in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vsillah/chatbot-template&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,N8N_WEBHOOK_URL&envDescription=Get%20these%20from%20Supabase%20and%20n8n&project-name=my-ai-chatbot)

Vercel will ask for your environment variables during setup — paste the same values from your `.env.local`.

---

## n8n Workflow Setup

Your chatbot needs an n8n workflow to process messages. A pre-built workflow is included:

1. Open your n8n instance
2. Import `n8n-workflows/simple-chat.json`
3. Add your OpenAI API key to the OpenAI node
4. Activate the workflow
5. Copy the webhook URL into your `.env.local`

See [n8n-workflows/README.md](n8n-workflows/README.md) for detailed instructions.

---

## Customization

All customization happens in the `config/` folder — you never need to touch `src/`.

### Change your branding

Edit `config/branding.ts`:

```typescript
const branding = {
  businessName: 'My Business',        // Your company name
  chatTitle: 'AI Assistant',           // Chat window title
  welcomeMessage: 'Hi! How can I...',  // First message users see
  suggestedActions: [ ... ],           // Quick-action buttons
  colors: { ... },                     // Tailwind color classes
}
```

### Change the AI personality

Edit `config/prompts.ts` to change what the AI says and how it behaves.

### Toggle features

Edit `config/features.ts`:

```typescript
const features = {
  voiceChat: true,          // Enable/disable voice
  chatHistory: true,        // Persist conversations
  suggestedActions: true,   // Show quick-action buttons
  clearChat: true,          // Allow clearing history
}
```

---

## Receiving Updates

When the template author releases improvements, a Pull Request will automatically appear in your repo. Your customizations in `config/` are never overwritten.

1. Check the PR in your repo's **Pull Requests** tab
2. Review the changes
3. Click **Merge pull request** if everything looks good

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## Project Structure

```
├── config/                  ← YOUR files (customize these)
│   ├── branding.ts          Business name, colors, messages
│   ├── prompts.ts           AI personality and instructions
│   ├── features.ts          Feature toggles
│   └── integrations.ts      Reads from .env.local
│
├── src/                     ← TEMPLATE files (auto-updated)
│   ├── app/                 Next.js pages and API routes
│   ├── components/chat/     Chat UI components
│   └── lib/                 Utilities and integrations
│
├── database/                SQL schema and seed data
├── n8n-workflows/           Importable n8n workflow
├── scripts/                 Setup wizard and doctor check
└── .github/                 CI and auto-update workflows
```

---

## Troubleshooting

### "npm run dev" shows errors

Run `npm run doctor` first — it checks every dependency and connection.

### Chat sends but no response comes back

1. Is your n8n workflow **active**? (toggle it ON in n8n)
2. Is the webhook URL correct? (check `.env.local`)
3. Run `npm run doctor` — it tests the webhook connection

### Database errors

Make sure you ran both SQL files in order:
1. `database/schema.sql` first
2. `database/seed.sql` second

### Voice chat not working

1. Check that `NEXT_PUBLIC_VAPI_PUBLIC_KEY` and `NEXT_PUBLIC_VAPI_ASSISTANT_ID` are set
2. Make sure `features.voiceChat` is `true` in `config/features.ts`
3. Allow microphone access when prompted by the browser

---

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run setup` | Interactive setup wizard |
| `npm run doctor` | Verify all connections and config |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Check for code issues |

---

## License

MIT
