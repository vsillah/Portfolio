# Railway n8n Setup - Quick Start

Your Railway n8n is reactivated! Here's your 20-minute setup guide.

---

## 🎯 Quick Setup (20 minutes)

### 1. Find Your Railway n8n URL (2 min)
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click your n8n project
3. Copy your URL: `https://n8n-production-XXXX.up.railway.app`

### 2. Import 3 Workflows (5 min)
1. Open your n8n URL in browser
2. Login to n8n
3. For each file in `/Users/mac15/my-portfolio/n8n-exports/`:
   - Workflows → + Add workflow → Import
   - Select: `WF-WRM-001-Facebook-Warm-Lead-Scraper.json`
   - Click Save
   - Repeat for WRM-002 and WRM-003

### 3. Add Environment Variables (8 min)
Railway Dashboard → Your n8n project → **Variables** tab → + New Variable

**Add these 7 variables:**
```bash
APIFY_TOKEN=your_apify_token
FACEBOOK_PROFILE_URL=https://facebook.com/your-profile
FACEBOOK_GROUP_UIDS=["group_id_1","group_id_2"]
LINKEDIN_COOKIE=your_li_at_cookie
LINKEDIN_PROFILE_URL=https://linkedin.com/in/your-profile
APP_BASE_URL=https://your-portfolio-domain.com
N8N_INGEST_SECRET=$(openssl rand -base64 32)
```

**Click Deploy** (Railway restarts n8n with new variables)

### 4. Update Next.js Webhook URLs (3 min)
Replace `YOUR-RAILWAY-URL` with your actual URL:

**In `.env.local`:**
```bash
N8N_WRM001_WEBHOOK_URL=https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-001-facebook
N8N_WRM002_WEBHOOK_URL=https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-002-google-contacts
N8N_WRM003_WEBHOOK_URL=https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-003-linkedin
N8N_INGEST_SECRET=your_generated_secret
```

### 5. Test & Activate (2 min)
```bash
# Test each workflow
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-001-facebook
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-002-google-contacts
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/webhook/wrm-003-linkedin

# Then in n8n UI: open each workflow → Toggle "Active" (top right)
```

---

## 📁 Files Ready for You

```
/Users/mac15/my-portfolio/
├── n8n-exports/
│   ├── WF-WRM-001-Facebook-Warm-Lead-Scraper.json     ← Import this
│   ├── WF-WRM-002-Google-Contacts-Sync.json           ← Import this
│   ├── WF-WRM-003-LinkedIn-Warm-Lead-Scraper.json     ← Import this
│   ├── environment-variables-reference.md              ← Detailed var setup
│   └── README.md                                       ← Architecture overview
│
└── docs/
    ├── n8n-railway-setup-guide.md                      ← Full setup guide
    └── n8n-cloud-migration-guide.md                    ← (Ignore - for n8n Cloud)
```

---

## 🔑 Getting Your API Keys

### Apify Token
1. Sign up at [apify.com](https://apify.com)
2. Settings → Integrations → Copy API token

### LinkedIn Cookie
1. Log into LinkedIn in Chrome
2. Press F12 → Application → Cookies
3. Find `li_at` cookie → Copy Value

### N8N Ingest Secret
```bash
# Run in terminal:
openssl rand -base64 32

# Or:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**⚠️ IMPORTANT:** Use the SAME secret in both Railway and Next.js `.env.local`!

---

## ✅ Verification Checklist

After setup:
- [ ] All 3 workflows imported and visible in n8n
- [ ] 7 environment variables added to Railway
- [ ] Railway deployed successfully (check Deployments tab)
- [ ] Webhook URLs updated in `.env.local`
- [ ] Test webhooks return success
- [ ] Workflows activated in n8n
- [ ] Dashboard shows warm lead sections: `/admin/outreach/dashboard`

---

## 🎉 You're Done!

**Schedules that will run automatically:**
- **Daily 8am:** Google Contacts sync
- **Monday 9am:** Facebook scraping
- **Wednesday 9am:** LinkedIn scraping

**Monitor executions:**
- n8n: Executions tab (left sidebar)
- Dashboard: `/admin/outreach/dashboard` (warm leads will appear)

---

## 📖 Full Documentation

For detailed setup, troubleshooting, and architecture:
- **Full setup guide:** `/Users/mac15/my-portfolio/docs/n8n-railway-setup-guide.md`
- **Environment variables:** `/Users/mac15/my-portfolio/n8n-exports/environment-variables-reference.md`

---

## 💰 Cost Estimate

**Railway n8n:**
- Container: ~512MB RAM
- Storage: Minimal
- **Estimated: $8-12/month**

**Savings vs n8n Cloud:** $12-16/month ($144-192/year)

---

## 🆘 Quick Troubleshooting

**Webhook returns 404:**
- Workflow must be Active (toggle in top right)
- Check webhook path matches exactly

**"Environment variable not found":**
- Check Railway Variables tab
- Click Deploy to restart n8n

**"401 Unauthorized" to ingest API:**
- Check `N8N_INGEST_SECRET` matches in Railway and `.env.local`

---

**Next Step:** Go to [Railway Dashboard](https://railway.app/dashboard) and get started! 🚀
