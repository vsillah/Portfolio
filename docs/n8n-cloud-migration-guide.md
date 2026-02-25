# n8n Cloud Migration Guide

This guide walks you through migrating from the local self-hosted n8n instance to n8n Cloud.

> **Last updated:** 2026-02-22. All 39 workflows exported and imported to n8n Cloud. Workflows are inactive pending credential setup.

## Migration Overview

**Current Setup:**
- Local self-hosted n8n instance (`https://n8n.amadutown.com` via Cloudflare tunnel)
- 39 active workflows (client management, lead pipeline, RAG chatbot, value evidence, meeting handlers, etc.)
- Managed via launchd on local Mac

**Target Setup:**
- n8n Cloud Free Tier (running in parallel with local until verified)
- 500 executions/month
- Fully managed, no infrastructure maintenance

**Migration Strategy:** Parallel operation. Both instances run simultaneously. The Next.js app uses `N8N_BASE_URL` env var to control which instance it talks to. Flip one variable to cut over.

---

## Step 1: Sign Up for n8n Cloud

**DONE.** Workspace: `https://amadutown.app.n8n.cloud`

**Free Tier Includes:**
- 500 workflow executions/month
- Unlimited workflows
- Community support
- 24/7 uptime
- Automatic updates

---

## Step 2: Export Workflows from Local n8n

**DONE (2026-02-22).** All 39 active workflows exported to `n8n-exports/` as individual JSON files.

Export was performed via n8n MCP (`n8n_get_workflow` with `mode='full'`) and the local SQLite database. Each file contains the full workflow definition (nodes, connections, settings, credentials references).

The full inventory is in `n8n-exports/manifest.json`.

---

## Step 3: Set Up n8n Cloud Environment

### 3.1 Access Your n8n Cloud Instance

Your workspace URL:
```
https://amadutown.app.n8n.cloud
```

### 3.2 Configure Environment Variables

In n8n Cloud, environment variables are set in **Settings → Environments** (available on all plans, including Free).

**Required Variables for Warm Lead Workflows:**

```bash
# Apify Integration
APIFY_TOKEN=your_apify_api_token_here

# Facebook Scraping
FACEBOOK_PROFILE_URL=https://www.facebook.com/your-profile
FACEBOOK_GROUP_UIDS=["group_id_1","group_id_2"]

# Google Contacts
GOOGLE_CONTACTS_TOKEN=your_google_oauth_token_here

# LinkedIn Scraping
LINKEDIN_COOKIE=your_li_at_cookie_value_here
LINKEDIN_PROFILE_URL=https://www.linkedin.com/in/your-profile

# Your Next.js App
APP_BASE_URL=https://your-portfolio-domain.com

# Webhook Authentication
N8N_INGEST_SECRET=your_secure_random_secret_here
```

**How to Set Environment Variables in n8n Cloud:**

1. Go to **Settings** (gear icon, bottom left)
2. Navigate to **Environments**
3. Click **+ Add Variable**
4. Enter **Name** and **Value**
5. Click **Save**

---

## Step 4: Import Workflows

**DONE (2026-02-22).** All 40 workflow JSON files (39 required + 1 extra) imported to n8n Cloud via the REST API.

Import was performed using `scripts/migrate-workflows-to-cloud.sh`, which:
1. Reads each JSON file from `n8n-exports/`
2. Strips instance-specific fields (keeps only `name`, `nodes`, `connections`, `settings`)
3. POSTs to `https://amadutown.app.n8n.cloud/api/v1/workflows`
4. All workflows imported as **inactive** (safe for parallel operation)

**Cloud workspace URL:** `https://amadutown.app.n8n.cloud`

### 4.1 Update Existing Workflows from Exports

After fixing workflow definitions in the local export files (e.g. webhook `$json.body.*` expressions), apply changes to n8n Cloud in bulk:

```bash
# Dry run first (shows what would be updated)
DRY_RUN=1 ./scripts/update-cloud-workflows-from-exports.sh

# Apply updates
./scripts/update-cloud-workflows-from-exports.sh
```

**Requirements:**
- `N8N_CLOUD_API_KEY` in `.env.local` (Settings → API in n8n Cloud)
- Workflows must already exist in Cloud (matched by name)

**Exports with fixes applied (as of 2026-02-22):**
- `Client-Progress-Update-Router.json` — webhook expressions use `$json.body.*` (n8n puts JSON body in `body`)

---

## Step 5: Update Webhook URLs in Your Next.js App

**DONE (2026-02-21).** The codebase now uses `N8N_BASE_URL` to control which n8n instance all webhooks target.

### How it works

`lib/n8n.ts` exports `N8N_BASE_URL` and `n8nWebhookUrl(path)`. All webhook constants use this pattern:

```typescript
const N8N_CLG002_WEBHOOK_URL = process.env.N8N_CLG002_WEBHOOK_URL
  || n8nWebhookUrl('clg-outreach-gen')
// => https://n8n.amadutown.com/webhook/clg-outreach-gen (or n8n Cloud if N8N_BASE_URL changed)
```

### Cut over to n8n Cloud (done 2026-02-25)

The app **default** is now n8n Cloud (`https://amadutown.app.n8n.cloud`). `lib/n8n.ts` falls back to this if `N8N_BASE_URL` is unset. In `.env.local`, `N8N_BASE_URL` and all `N8N_*_WEBHOOK_URL` values point to n8n Cloud.

To use **self-hosted** n8n instead, set:

```bash
N8N_BASE_URL=https://n8n.amadutown.com
```
and set any per-workflow `N8N_*_WEBHOOK_URL` to the self-hosted URLs.

Per-workflow env vars still override the base URL when set.

---

## Step 6: Configure Credentials

Some workflows require OAuth2 credentials (Slack, Google, Gmail, etc.). In n8n Cloud:

1. Go to **Credentials** (sidebar)
2. Click **+ Add Credential**
3. Select the service (e.g., "Google OAuth2")
4. Follow the OAuth flow to authorize

**Credentials You'll Need:**
- **Slack OAuth2** (for client management workflows)
- **Google OAuth2** (for Google Contacts, Sheets, etc.)
- **Gmail OAuth2** (for email automation)
- **Calendly** (for meeting handlers)
- **OpenAI API** (for AI agents)
- **Apify API** (for web scraping)

**Community Nodes:**
- **Apify** (`@apify/n8n-nodes-apify`) — Install from Community Nodes to replace HTTP Request calls to Apify. See `docs/n8n-apify-node-swap-guide.md` for the swap instructions.

💡 **Tip:** n8n Cloud provides pre-configured OAuth apps for major services (Google, Slack, etc.), making setup easier than self-hosted.

---

## Step 7: Test Your Workflows

### Test Warm Lead Workflows

**WF-WRM-001: Facebook Warm Lead Scraper**
```bash
curl -X POST https://your-workspace.app.n8n.cloud/webhook/wrm-001-facebook \
  -H "Content-Type: application/json" \
  -d '{}'
```

**WF-WRM-002: Google Contacts Sync**
```bash
curl -X POST https://your-workspace.app.n8n.cloud/webhook/wrm-002-google-contacts \
  -H "Content-Type: application/json" \
  -d '{}'
```

**WF-WRM-003: LinkedIn Warm Lead Scraper**
```bash
curl -X POST https://your-workspace.app.n8n.cloud/webhook/wrm-003-linkedin \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test via Next.js App

```bash
# From your my-portfolio directory
npm run dev

# In another terminal, trigger a scrape:
curl -X POST http://localhost:3000/api/admin/trigger-warm-scrape \
  -H "Authorization: Bearer your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{"source": "facebook"}'
```

### Monitor Executions

1. In n8n Cloud, go to **Executions** (sidebar)
2. Check for successful runs (green) or errors (red)
3. Click any execution to view detailed logs

---

## Step 8: Activate Workflows

Once tested successfully:

1. Open each workflow
2. Toggle the **Active** switch (top right)
3. Scheduled triggers will now run automatically

**Recommended Activation Order:**
1. ✅ WF-WRM-002 (Google Contacts) - Daily 8am
2. ✅ WF-WRM-001 (Facebook) - Weekly Mon 9am
3. ✅ WF-WRM-003 (LinkedIn) - Weekly Wed 9am

---

## Step 9: Monitor Free Tier Usage

**Free Tier Limit:** 500 executions/month

### Your Current Execution Estimate:
- **Warm Lead Workflows:**
  - WF-WRM-001: 4/month (weekly)
  - WF-WRM-002: 30/month (daily)
  - WF-WRM-003: 4/month (weekly)
  - **Subtotal:** ~38/month

- **Cold Lead Pipeline:** ~50/month
- **Client Management Flows:** ~100-150/month (estimated)
- **RAG Chatbot:** Variable (depends on usage)

**Estimated Total:** ~200-250/month (well within 500 limit)

### Monitor Usage:
1. Go to **Settings** → **Usage**
2. Track monthly execution count
3. Optimize workflows if approaching limit

---

## Step 10: Update Your Documentation

Update `docs/n8n-variables-setup.md` and any other docs referencing Railway to point to n8n Cloud.

---

## Troubleshooting

### Issue: "Environment variable not found"
**Solution:** Double-check spelling in Settings → Environments. Variable names are case-sensitive.

### Issue: "Webhook not found"
**Solution:** Ensure workflow is **Active** and webhook path matches your URL exactly.

### Issue: "Credential invalid"
**Solution:** Re-authenticate OAuth2 credentials. n8n Cloud handles token refresh automatically.

### Issue: "Execution timed out"
**Solution:** Apify actors can take 2-3 minutes. Increase timeout in HTTP Request node settings (already set to 180-240s in exported workflows).

### Issue: "Approaching execution limit"
**Solution:** 
1. Reduce scraping frequency (e.g., Facebook/LinkedIn to bi-weekly)
2. Consider upgrading to Starter plan ($20/mo, 2,500 executions)
3. Optimize workflows to combine steps

---

## Rollback Plan (If Needed)

If n8n Cloud doesn't work out:

1. **Keep local n8n running** — it's still active and all workflows are live there
2. **Revert `N8N_BASE_URL`** in `.env.local` back to `https://n8n.amadutown.com`
3. The local instance is managed via launchd and the Cloudflare tunnel, no action needed

---

## Next Steps

After migration is complete:

1. ✅ **Test dashboard:** Visit `https://your-portfolio-domain.com/admin/outreach/dashboard`
2. ✅ **Verify warm leads appear** in the dashboard
3. ✅ **Archive Railway n8n** (after confirming all workflows work)
4. ✅ **Update your TODO:** Mark warm lead implementation as complete!

---

## Support

- **n8n Community Forum:** [community.n8n.io](https://community.n8n.io)
- **n8n Documentation:** [docs.n8n.io](https://docs.n8n.io)
- **n8n Cloud Status:** [status.n8n.io](https://status.n8n.io)

---

## Summary Checklist

- [x] Update Next.js codebase for `N8N_BASE_URL` pattern (2026-02-21)
- [x] Inventory all 39 active workflows in manifest (2026-02-21)
- [x] Sign up for n8n Cloud and get workspace URL (2026-02-22) — `https://amadutown.app.n8n.cloud`
- [x] Export all workflows from local n8n (2026-02-22) — 40 JSON files in `n8n-exports/`
- [x] Import workflows into n8n Cloud (2026-02-22) — 40/40 imported via API, all inactive
- [ ] Set environment variables / credentials in n8n Cloud
- [ ] Configure OAuth2 credentials (Slack, Google, Gmail, Calendly, OpenAI, Apify, Stripe, Supabase)
- [ ] Test workflows on n8n Cloud (start with low-risk: warm lead scrapers)
- [ ] Activate workflows on n8n Cloud
- [x] Flip `N8N_BASE_URL` to `https://amadutown.app.n8n.cloud` in `.env.local` and redeploy (2026-02-25)
- [ ] Monitor execution usage (500/month free tier)
- [ ] Deactivate workflows on local n8n (keep as backup)
- [ ] After 2 weeks stable: archive local n8n instance

---

**Estimated Migration Time:** 1-2 hours

**Risk Level:** Low (n8n Cloud is production-ready and more reliable than Railway)

**Cost:** $0/month (Free Tier)

Good luck with the migration! Let me know if you run into any issues.
