# n8n Workflow Exports

This folder contains exported n8n workflows ready for import into n8n Cloud.

## 📁 Contents

### Workflows
- **WF-WRM-001-Facebook-Warm-Lead-Scraper.json**
  - Scrapes Facebook friends, group members, and post engagement
  - Schedule: Weekly (Mondays at 9am)
  - Apify actors: `alien_force/facebook-scraper-pro`, `mdgjtp1/facebook-group-member`, `apify/facebook-comments-scraper`

- **WF-WRM-002-Google-Contacts-Sync.json**
  - Syncs Google Contacts with business information
  - Schedule: Daily (8am)
  - Uses Google People API

- **WF-WRM-003-LinkedIn-Warm-Lead-Scraper.json**
  - Scrapes LinkedIn connections and post engagement
  - Schedule: Weekly (Wednesdays at 9am)
  - Apify actors: `addeus/get-connections`, `harvestapi/linkedin-profile-posts`

### Documentation
- **environment-variables-reference.md**
  - Complete list of required environment variables
  - Setup instructions for each variable
  - Security best practices
  - Troubleshooting guide

## 🚀 Quick Start

### 1. Set Up n8n Cloud
```bash
# Sign up at n8n.cloud
# Get your workspace URL: https://your-workspace.app.n8n.cloud
```

### 2. Import or Update Workflows

**Option A: Bulk import (new workflows)**  
```bash
./scripts/migrate-workflows-to-cloud.sh
```

**Option B: Update existing workflows from exports**  
Use when export files have been fixed and you want to push changes to Cloud:
```bash
DRY_RUN=1 ./scripts/update-cloud-workflows-from-exports.sh  # Preview
./scripts/update-cloud-workflows-from-exports.sh            # Apply
```
Requires `N8N_CLOUD_API_KEY` in `.env.local`. Matches by workflow name.

**Option C: Manual import**  
1. In n8n Cloud, go to **Workflows** → **+ Add workflow**
2. Click menu (...) → **Import**
3. Upload each JSON file

### 3. Configure Environment Variables
Go to **Settings → Environments** and add:
- `APIFY_TOKEN`
- `FACEBOOK_PROFILE_URL`
- `FACEBOOK_GROUP_UIDS`
- `LINKEDIN_COOKIE`
- `LINKEDIN_PROFILE_URL`
- `APP_BASE_URL`
- `N8N_INGEST_SECRET`

See [environment-variables-reference.md](./environment-variables-reference.md) for details.

### 4. Test Workflows
```bash
# Test each webhook
curl -X POST https://your-workspace.app.n8n.cloud/webhook/wrm-001-facebook
curl -X POST https://your-workspace.app.n8n.cloud/webhook/wrm-002-google-contacts
curl -X POST https://your-workspace.app.n8n.cloud/webhook/wrm-003-linkedin
```

### 5. Activate Workflows
Toggle the **Active** switch in each workflow (top right).

## 📊 Workflow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    n8n Cloud                             │
│                                                          │
│  WF-WRM-001          WF-WRM-002          WF-WRM-003     │
│  (Facebook)          (Google)            (LinkedIn)     │
│      ↓                   ↓                    ↓          │
│  Apify Actors      Google API         Apify Actors     │
│      ↓                   ↓                    ↓          │
│  Normalize          Normalize           Normalize       │
│      ↓                   ↓                    ↓          │
│      └───────────────────┴────────────────────┘          │
│                         ↓                                │
│              POST /api/admin/outreach/ingest            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Next.js App (my-portfolio)                  │
│                                                          │
│  /api/admin/outreach/ingest  →  Postgres DB             │
│                  ↓                                        │
│  /api/admin/outreach/dashboard  ←  Frontend             │
└─────────────────────────────────────────────────────────┘
```

## 🔐 Security Considerations

### Sensitive Data
These exported workflows contain **NO sensitive data**:
- ✅ No API keys
- ✅ No tokens
- ✅ No credentials
- ✅ Only workflow structure and logic

Environment variables must be set separately in n8n Cloud.

### Required Credentials
- **Apify Token:** For web scraping actors
- **LinkedIn Cookie:** For connections scraper (expires ~1 year)
- **N8N Ingest Secret:** For webhook authentication (must match Next.js app)
- **Google OAuth2:** For Contacts API (use n8n's built-in OAuth2)

## 📈 Expected Usage

### Execution Frequency
- **WF-WRM-001:** 4 executions/month (weekly)
- **WF-WRM-002:** 30 executions/month (daily)
- **WF-WRM-003:** 4 executions/month (weekly)

**Total:** ~38 executions/month (well within n8n Cloud Free Tier's 500/month)

### Data Volume
- **Facebook:** ~50-200 leads/week (friends + groups + engagement)
- **Google Contacts:** ~100-500 contacts/sync (filtered for business info)
- **LinkedIn:** ~300-1000 connections + ~50-200 engagers/week

## 🛠️ Troubleshooting

### Common Issues

**"Environment variable not found"**
- Check spelling in Settings → Environments
- Variable names are case-sensitive

**"Webhook not found"**
- Ensure workflow is **Active**
- Verify webhook path matches URL

**"Apify actor timeout"**
- Apify actors can take 2-3 minutes
- Timeouts are set to 180-240 seconds (already configured)
- If still timing out, reduce `resultsLimit` or `maxPosts`

**"LinkedIn cookie invalid"**
- Cookie expires ~1 year
- Get fresh `li_at` cookie from logged-in session
- Update in n8n Cloud environment variables

## 📚 Additional Resources

- [n8n Cloud Migration Guide](../docs/n8n-cloud-migration-guide.md)
- [n8n Documentation](https://docs.n8n.io)
- [n8n Community Forum](https://community.n8n.io)
- [Apify Documentation](https://docs.apify.com)

## ✅ Migration Checklist

- [ ] Sign up for n8n Cloud
- [ ] Import 3 warm lead workflows
- [ ] Set 7 environment variables
- [ ] Configure Google OAuth2 credential (optional, for better reliability)
- [ ] Test each workflow manually
- [ ] Update Next.js app webhook URLs
- [ ] Activate workflows
- [ ] Monitor executions for 1 week
- [ ] Archive Railway n8n instance

## 🆘 Need Help?

If you encounter issues during migration:
1. Check [environment-variables-reference.md](./environment-variables-reference.md)
2. Review [n8n-cloud-migration-guide.md](../docs/n8n-cloud-migration-guide.md)
3. Search [n8n Community Forum](https://community.n8n.io)
4. Contact n8n support (available on all plans, including Free)

---

**Last Updated:** February 7, 2026  
**n8n Version:** Compatible with n8n Cloud (latest)  
**Status:** Ready for import
