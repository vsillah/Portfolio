# n8n Railway Setup Guide - Warm Lead Workflows

Quick guide to add the 3 new warm lead scraping workflows to your Railway n8n instance.

---

## ✅ Step 1: Access Your Railway n8n Instance

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click on your n8n project
3. Find your n8n deployment URL (should look like: `https://n8n-production-XXXX.up.railway.app`)
4. Open the URL in your browser
5. Log in to your n8n instance

---

## 📥 Step 2: Import the 3 Warm Lead Workflows

### Import Files Location:
```
/Users/mac15/my-portfolio/n8n-exports/
├── WF-WRM-001-Facebook-Warm-Lead-Scraper.json
├── WF-WRM-002-Google-Contacts-Sync.json
└── WF-WRM-003-LinkedIn-Warm-Lead-Scraper.json
```

### Import Process:
1. In n8n, click **Workflows** (left sidebar)
2. Click **+ Add workflow** (top right)
3. Click the **menu (...)** → **Import from File**
4. Select `WF-WRM-001-Facebook-Warm-Lead-Scraper.json`
5. Click **Save** (top right)
6. Repeat for the other 2 workflows

**Result:** You should now have 3 new workflows (inactive) ready to configure.

---

## 🔐 Step 3: Set Environment Variables in Railway

### Access Railway Variables:
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click your n8n project
3. Click the **Variables** tab
4. Click **+ New Variable**

### Add These 7 Variables:

#### 1. Apify Integration
```bash
APIFY_TOKEN=
```
**Get it:** [apify.com](https://apify.com) → Settings → Integrations → API Token

---

#### 2. Facebook Scraping
```bash
FACEBOOK_PROFILE_URL=https://www.facebook.com/your-profile
FACEBOOK_GROUP_UIDS=["123456789","987654321"]
```
**Notes:**
- `FACEBOOK_PROFILE_URL`: Your Facebook profile URL
- `FACEBOOK_GROUP_UIDS`: Array of Facebook group IDs (find in group URL)
  - Format must be valid JSON array with quotes

---

#### 3. Google Contacts
```bash
GOOGLE_CONTACTS_TOKEN=
```
**Get it:** 
- **Recommended:** Use n8n's built-in Google OAuth2 credential instead (more reliable)
- **Alternative:** Get OAuth token from Google Cloud Console with scope: `https://www.googleapis.com/auth/contacts.readonly`

---

#### 4. LinkedIn Scraping
```bash
LINKEDIN_COOKIE=
LINKEDIN_PROFILE_URL=https://www.linkedin.com/in/your-profile
```
**Get LinkedIn Cookie:**
1. Log into LinkedIn in Chrome
2. Press F12 (DevTools) → Application → Cookies
3. Find `li_at` cookie
4. Copy the **Value** (long string)
5. Paste as `LINKEDIN_COOKIE` value

**Security:** Cookie expires in ~1 year, rotate annually

---

#### 5. Your Next.js App
```bash
APP_BASE_URL=https://your-portfolio-domain.com
N8N_INGEST_SECRET=
```
**For `N8N_INGEST_SECRET`:**
```bash
# Generate a secure random secret (run in terminal):
openssl rand -base64 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

⚠️ **IMPORTANT:** Copy this exact secret to your Next.js `.env.local` file!

---

### After Adding All Variables:
1. Click **Deploy** (Railway will restart n8n with new variables)
2. Wait 2-3 minutes for n8n to restart
3. Refresh your n8n browser tab

---

## 🌐 Step 4: Update Next.js Webhook URLs

Your Railway n8n URL will be something like:
```
https://n8n-production-a1b2c3d4.up.railway.app
```

### Update `lib/n8n.ts`:

Find your current Railway URL, then update:

```typescript
// lib/n8n.ts

// Warm Lead Webhook URLs (add these)
const N8N_WRM001_WEBHOOK_URL = 
  process.env.N8N_WRM001_WEBHOOK_URL || 
  'https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-001-facebook';

const N8N_WRM002_WEBHOOK_URL = 
  process.env.N8N_WRM002_WEBHOOK_URL || 
  'https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-002-google-contacts';

const N8N_WRM003_WEBHOOK_URL = 
  process.env.N8N_WRM003_WEBHOOK_URL || 
  'https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-003-linkedin';
```

### Update `.env.local`:

```bash
# n8n Warm Lead Webhook URLs
N8N_WRM001_WEBHOOK_URL=https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-001-facebook
N8N_WRM002_WEBHOOK_URL=https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-002-google-contacts
N8N_WRM003_WEBHOOK_URL=https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-003-linkedin

# Webhook Authentication (must match Railway variable)
N8N_INGEST_SECRET=your_generated_secret_here
```

---

## 🧪 Step 5: Test the Workflows

### Test via Webhook (Terminal):

Replace `YOUR-RAILWAY-URL` with your actual URL:

```bash
# Test Facebook workflow
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-001-facebook \
  -H "Content-Type: application/json" \
  -d '{}'

# Test Google Contacts workflow
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-002-google-contacts \
  -H "Content-Type: application/json" \
  -d '{}'

# Test LinkedIn workflow
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-003-linkedin \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:** `{ "success": true }` (from webhook)

### Test via n8n UI:

1. Open each workflow in n8n
2. Click **Execute Workflow** (top right)
3. Check **Executions** tab for results
4. Look for green checkmarks (success) or red X (errors)

### Monitor Execution Logs:

In n8n:
1. Click **Executions** (left sidebar)
2. Click any execution to see detailed logs
3. Check each node for output data
4. Verify leads are being posted to your ingest API

---

## ✅ Step 6: Activate Workflows

Once tested successfully:

1. Open **WF-WRM-002: Google Contacts Sync**
   - Toggle **Active** (top right)
   - Will run daily at 8am

2. Open **WF-WRM-001: Facebook Warm Lead Scraper**
   - Toggle **Active**
   - Will run weekly on Mondays at 9am

3. Open **WF-WRM-003: LinkedIn Warm Lead Scraper**
   - Toggle **Active**
   - Will run weekly on Wednesdays at 9am

---

## 🔍 Step 7: Verify Dashboard Integration

1. Go to your Next.js app: `https://your-portfolio-domain.com/admin/outreach/dashboard`
2. You should see:
   - ✅ **Lead Temperature Summary** (Warm/Cold toggle)
   - ✅ **Warm lead sources** in breakdown (Google Contacts, Facebook, LinkedIn)
   - ✅ New leads appearing after workflow runs

---

## 📊 Monitoring & Maintenance

### Check Execution Usage:
- n8n UI → **Executions** → View all runs
- Monitor for errors (red X)

### Expected Monthly Executions:
- **WF-WRM-001 (Facebook):** 4/month (weekly)
- **WF-WRM-002 (Google Contacts):** 30/month (daily)
- **WF-WRM-003 (LinkedIn):** 4/month (weekly)
- **Total:** ~38 warm lead executions/month

### Railway Cost Estimate:
- n8n container: ~512MB RAM
- Estimated: **$8-12/month**

---

## 🛠️ Troubleshooting

### Issue: "Environment variable not found"
**Solution:** 
1. Check Railway Variables tab
2. Ensure variable names match exactly (case-sensitive)
3. Redeploy n8n after adding variables
4. Wait 2-3 minutes for restart

---

### Issue: "Webhook not found (404)"
**Solution:**
1. Ensure workflow is **Active** (toggle in top right)
2. Check webhook path matches: `/webhook/wrm-001-facebook`
3. Verify Railway URL is correct (no typos)

---

### Issue: "Apify actor timeout"
**Solution:**
- Actors can take 2-3 minutes to run
- Timeouts are already set to 180-240 seconds
- If still timing out, reduce `resultsLimit` or `maxPosts` in workflow

---

### Issue: "401 Unauthorized" when posting to ingest API
**Solution:**
1. Check `N8N_INGEST_SECRET` matches in both:
   - Railway Variables
   - Next.js `.env.local`
2. Verify `APP_BASE_URL` is correct in Railway
3. Check Authorization header format: `Bearer YOUR_SECRET`

---

### Issue: "LinkedIn cookie invalid"
**Solution:**
1. Cookie expires after ~1 year
2. Log out and back into LinkedIn
3. Get fresh `li_at` cookie from DevTools
4. Update in Railway Variables
5. Redeploy

---

## 🔒 Security Best Practices

1. **Never commit secrets to Git**
   - `.env.local` is already in `.gitignore`

2. **Rotate credentials regularly**
   - LinkedIn cookie: Annually
   - API tokens: Every 90 days
   - `N8N_INGEST_SECRET`: If suspected leak

3. **Use HTTPS only**
   - Railway provides automatic SSL
   - Never use `http://` for webhooks

4. **Monitor Railway logs**
   - Railway Dashboard → Deployments → Logs
   - Watch for unauthorized access attempts

---

## 🎯 Success Checklist

- [ ] Accessed Railway n8n instance
- [ ] Imported 3 warm lead workflows
- [ ] Added 7 environment variables to Railway
- [ ] Redeployed n8n (Railway auto-deploys on variable change)
- [ ] Updated `lib/n8n.ts` with Railway webhook URLs
- [ ] Updated `.env.local` with webhook URLs and secret
- [ ] Tested each workflow via webhook/UI
- [ ] Activated all 3 workflows
- [ ] Verified leads appear in dashboard
- [ ] Monitored first execution for errors

---

## 📚 Quick Reference

### Railway n8n URL Format:
```
https://n8n-production-XXXX.up.railway.app
```

### Webhook Paths:
- Facebook: `/webhook/wrm-001-facebook`
- Google Contacts: `/webhook/wrm-002-google-contacts`
- LinkedIn: `/webhook/wrm-003-linkedin`

### Execution Schedule:
- **Daily 8am:** Google Contacts sync
- **Monday 9am:** Facebook scrape
- **Wednesday 9am:** LinkedIn scrape

---

## 🆘 Need Help?

1. **Railway Issues:** [Railway Discord](https://discord.gg/railway)
2. **n8n Issues:** [n8n Community Forum](https://community.n8n.io)
3. **Workflow Files:** `/Users/mac15/my-portfolio/n8n-exports/`
4. **Environment Variables Reference:** `/Users/mac15/my-portfolio/n8n-exports/environment-variables-reference.md`

---

**Estimated Setup Time:** 20-30 minutes

**Status:** Ready to deploy on Railway ✅

Good luck! 🚀
