# Install Guide — n8n Warm Lead Pack

## Prerequisites

- n8n Cloud or self-hosted n8n
- Apify account (for Facebook/LinkedIn actors)
- Google Cloud project (optional, for Google Contacts)
- Next.js app with ingest API: `POST /api/admin/outreach/ingest`

## 1. Import workflows into n8n

1. In n8n, go to **Workflows** → **Add workflow**.
2. Use the menu (...) → **Import**.
3. Import each JSON file:
   - `WF-WRM-001-Facebook-Warm-Lead-Scraper.json`
   - `WF-WRM-002-Google-Contacts-Sync.json`
   - `WF-WRM-003-LinkedIn-Warm-Lead-Scraper.json`

## 2. Environment variables in n8n

In n8n Cloud: **Settings** → **Environments**. Add:

- `APIFY_TOKEN` — from apify.com
- `APP_BASE_URL` — your Next.js app URL (e.g. https://your-site.com)
- `N8N_INGEST_SECRET` — must match the secret used by your app to validate webhook calls
- (Optional) `FACEBOOK_PROFILE_URL`, `FACEBOOK_GROUP_UIDS`
- (Optional) `LINKEDIN_COOKIE`, `LINKEDIN_PROFILE_URL`

See `environment-variables-reference.md` in this folder for details.

## 3. Configure ingest endpoint

Each workflow should end with an HTTP Request node that POSTs to:

```
{{ $env.APP_BASE_URL }}/api/admin/outreach/ingest
```

Headers:

- `Authorization: Bearer {{ $env.N8N_INGEST_SECRET }}`
- `Content-Type: application/json`

Body: normalized lead payload (see main portfolio docs for schema).

## 4. Activate workflows

Toggle each workflow **Active** (top right). Set schedules as needed (e.g. weekly for scrapers, daily for Google Contacts).

## 5. Verify

Run one workflow manually. Check your app’s ingest API and database to confirm leads appear.

## Troubleshooting

- **401 Unauthorized**: Ensure `N8N_INGEST_SECRET` matches the app’s expected token.
- **Apify timeout**: Increase timeout in the Apify node (e.g. 180–240 seconds).
- **LinkedIn cookie**: Refresh `li_at` periodically (expires ~1 year).
