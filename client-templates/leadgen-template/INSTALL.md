# Install Guide — Lead Generation Template

## Prerequisites

- Node.js 18+
- Supabase project
- n8n instance (for lead enrichment webhook)

## 1. Clone or copy

Clone the spin-off repo (if available) or copy the template directory. The template is fully self-contained — all boilerplate (tsconfig, next.config, tailwind, layout, etc.) and auth utilities are included. No `copy-shared.sh` step is needed.

```bash
git clone https://github.com/your-org/leadgen-template.git
cd leadgen-template
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
