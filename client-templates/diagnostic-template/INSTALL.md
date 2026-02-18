# Install Guide — Diagnostic Template

## Prerequisites

- Node.js 18+
- Supabase project
- (Optional) n8n instance for completion webhook

## 1. Clone or copy

Copy the `diagnostic-template` folder into your Next.js app or use it as a standalone module.

## 2. Database

Run the SQL files in `database/` in your Supabase SQL editor. This creates:

- Tables for diagnostic audits and session linkage
- Any required RLS policies

## 3. Environment variables

Add to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL=https://your-n8n.com/webhook/diagnostic-complete
```

## 4. Deploy

- Deploy your Next.js app (Vercel, etc.).
- Configure the completion webhook in n8n to receive audit payloads and trigger follow-up (e.g. create sales session, notify team).

## 5. Customize

- Edit diagnostic questions and prompts in your app or database.
- Point the completion webhook to your n8n workflow.

## Support

See the main portfolio repo or docs for API contract (payload shape for the completion webhook).
