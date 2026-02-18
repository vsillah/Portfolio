# Install Guide — Lead Generation Template

## Prerequisites

- Node.js 18+
- Supabase project
- n8n instance (for lead enrichment webhook)

## 1. Clone or copy

```bash
cp -r leadgen-template /path/to/your-project
cd /path/to/your-project
```

## 2. Install dependencies

```bash
npm install
```

## 3. Database

Run the SQL files in `database/` in Supabase (contact_submissions, lead magnets, etc.).

## 4. Environment variables

Copy `.env.example` to `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `N8N_LEAD_WEBHOOK_URL` — webhook for lead qualification/enrichment
- (Optional) `SUPABASE_SERVICE_ROLE_KEY`

## 5. n8n workflow

- Webhook trigger receives new lead payload (email, name, source, etc.).
- Add nodes for enrichment (company lookup, scoring).
- End with HTTP Request to your app API to update the lead, or write to Supabase.

## 6. Configure forms

- Customize the contact form fields in the template components.
- Configure exit intent and lead magnet delivery in the app.

## 7. Run and deploy

```bash
npm run dev
```

Deploy to Vercel; set env vars in the dashboard. Ensure the ingest/webhook URL matches what n8n calls.
