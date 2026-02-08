# n8n Cloud Migration Guide

This guide walks you through migrating from your Railway-hosted n8n instance to n8n Cloud Free Tier.

## Migration Overview

**Current Setup:**
- Railway.app n8n instance (trial expired)
- 48 workflows (15 active, including client management, lead pipeline, RAG chatbot)
- Custom Docker deployment

**Target Setup:**
- n8n Cloud Free Tier
- 500 executions/month (should be sufficient for your usage pattern)
- Fully managed, no infrastructure maintenance

---

## Step 1: Sign Up for n8n Cloud

1. Go to [n8n.cloud](https://n8n.cloud)
2. Click "Start for Free"
3. Sign up with your email (`vsillah@gmail.com` based on your current n8n account)
4. Verify your email

**Free Tier Includes:**
- 500 workflow executions/month
- Unlimited workflows
- Community support
- 24/7 uptime
- Automatic updates

---

## Step 2: Export ALL Workflows from Railway (IMPORTANT!)

### Option A: If You Can Briefly Reactivate Railway

If you can temporarily reactivate your Railway account (even for a day):

1. **Add Payment Method** to Railway (won't be charged immediately)
2. **Unpause** the n8n service
3. **Wait 2-3 minutes** for n8n to start
4. **Access n8n UI** at your Railway URL
5. **Export workflows:**
   - Settings → Import/Export → Export All Workflows
   - Save the `.json` file (will contain all 48 workflows)
6. **Pause Railway** again to avoid charges

### Option B: If Railway Access is Impossible

I've already exported your 3 new warm lead workflows to `/Users/mac15/my-portfolio/n8n-exports/`:
- `WF-WRM-001-Facebook-Warm-Lead-Scraper.json`
- `WF-WRM-002-Google-Contacts-Sync.json`
- `WF-WRM-003-LinkedIn-Warm-Lead-Scraper.json`

⚠️ **However**, you have **15 active workflows** that are critical to your business:
- Client management flows (WF-000 through WF-012)
- Cold lead pipeline (WF-CLG-001 through WF-CLG-004)
- Meeting handlers (WF-CAL, WF-MCH, WF-AGB, etc.)
- RAG chatbot for AmaduTown

**These workflows are NOT backed up yet.** I strongly recommend Option A to avoid data loss.

---

## Step 3: Set Up n8n Cloud Environment

### 3.1 Access Your New n8n Cloud Instance

After signing up, you'll get a custom URL like:
```
https://your-workspace.app.n8n.cloud
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

### 4.1 Import the 3 New Warm Lead Workflows

1. In n8n Cloud, click **Workflows** → **+ Add workflow**
2. Click the **menu (...)** → **Import**
3. Upload each of the 3 exported JSON files:
   - `WF-WRM-001-Facebook-Warm-Lead-Scraper.json`
   - `WF-WRM-002-Google-Contacts-Sync.json`
   - `WF-WRM-003-LinkedIn-Warm-Lead-Scraper.json`

### 4.2 Import Your Existing Workflows (if you have the export)

If you were able to export all workflows from Railway:

1. Click **Settings** → **Import/Export**
2. Click **Import workflows from file**
3. Select your exported file
4. All workflows will be imported (inactive by default)

---

## Step 5: Update Webhook URLs in Your Next.js App

Your Next.js app's `lib/n8n.ts` currently references Railway webhook URLs. Update them to your new n8n Cloud URLs:

```typescript
// lib/n8n.ts

// OLD (Railway URLs):
const N8N_WRM001_WEBHOOK_URL = process.env.N8N_WRM001_WEBHOOK_URL || 'https://n8n-production-XXXX.up.railway.app/webhook/wrm-001-facebook';

// NEW (n8n Cloud URLs):
const N8N_WRM001_WEBHOOK_URL = process.env.N8N_WRM001_WEBHOOK_URL || 'https://your-workspace.app.n8n.cloud/webhook/wrm-001-facebook';
const N8N_WRM002_WEBHOOK_URL = process.env.N8N_WRM002_WEBHOOK_URL || 'https://your-workspace.app.n8n.cloud/webhook/wrm-002-google-contacts';
const N8N_WRM003_WEBHOOK_URL = process.env.N8N_WRM003_WEBHOOK_URL || 'https://your-workspace.app.n8n.cloud/webhook/wrm-003-linkedin';
```

**Update your `.env.local`:**

```bash
N8N_WRM001_WEBHOOK_URL=https://your-workspace.app.n8n.cloud/webhook/wrm-001-facebook
N8N_WRM002_WEBHOOK_URL=https://your-workspace.app.n8n.cloud/webhook/wrm-002-google-contacts
N8N_WRM003_WEBHOOK_URL=https://your-workspace.app.n8n.cloud/webhook/wrm-003-linkedin
```

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

If n8n Cloud doesn't work out, you can:

1. **Reactivate Railway** with paid plan
2. **Switch to Render** (alternative free hosting)
3. **Run locally** on your Mac with Docker

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

- [ ] Sign up for n8n Cloud
- [ ] Export all workflows from Railway (if possible)
- [ ] Import workflows into n8n Cloud
- [ ] Set environment variables in n8n Cloud
- [ ] Configure OAuth2 credentials
- [ ] Update webhook URLs in Next.js app
- [ ] Test warm lead workflows
- [ ] Activate workflows
- [ ] Monitor execution usage
- [ ] Archive Railway instance

---

**Estimated Migration Time:** 1-2 hours

**Risk Level:** Low (n8n Cloud is production-ready and more reliable than Railway)

**Cost:** $0/month (Free Tier)

Good luck with the migration! Let me know if you run into any issues.
