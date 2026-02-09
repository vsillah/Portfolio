# n8n Cloud Environment Variables Reference

This file contains all environment variables needed for your n8n workflows on n8n Cloud.

## Quick Setup Commands

Copy these values into **Settings → Environments** in n8n Cloud:

---

## Core Integration Variables

### Apify (Web Scraping)
```bash
APIFY_TOKEN=your_apify_api_token_here
```
**Where to get:**
1. Sign up at [apify.com](https://apify.com)
2. Go to Settings → Integrations → API
3. Copy your API token

---

### Facebook Scraping
```bash
FACEBOOK_PROFILE_URL=https://www.facebook.com/your-profile
FACEBOOK_GROUP_UIDS=["123456789","987654321"]
```
**Where to get:**
- `FACEBOOK_PROFILE_URL`: Your Facebook profile URL
- `FACEBOOK_GROUP_UIDS`: Facebook group IDs (numeric, JSON array format)
  - Get from group URL: `facebook.com/groups/[GROUP_ID]`

---

### Google Contacts
```bash
GOOGLE_CONTACTS_TOKEN=your_google_oauth_access_token_here
```
**Where to get:**
- Use n8n's built-in Google OAuth2 credential instead (recommended)
- Scope needed: `https://www.googleapis.com/auth/contacts.readonly`
- n8n will handle token refresh automatically

**Alternative (using n8n Credential):**
- In WF-WRM-002, replace the HTTP Request node with n8n's "Google Contacts" node
- This is more reliable and handles OAuth refresh automatically

---

### LinkedIn Scraping
```bash
LINKEDIN_COOKIE=your_li_at_cookie_value_here
LINKEDIN_PROFILE_URL=https://www.linkedin.com/in/your-profile
```
**Where to get:**
- `LINKEDIN_COOKIE`: 
  1. Log into LinkedIn in Chrome
  2. Open DevTools (F12) → Application → Cookies
  3. Copy value of `li_at` cookie
  4. ⚠️ **Security:** This cookie expires ~1 year, rotate annually
- `LINKEDIN_PROFILE_URL`: Your LinkedIn profile URL

---

### Your Next.js Application
```bash
APP_BASE_URL=https://your-portfolio-domain.com
N8N_INGEST_SECRET=your_secure_random_secret_here
```
**Where to get:**
- `APP_BASE_URL`: Your deployed Next.js app URL (production)
  - For local testing: `http://localhost:3000`
- `N8N_INGEST_SECRET`: 
  - Generate with: `openssl rand -base64 32`
  - Or use: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
  - ⚠️ **Must match** the value in your Next.js `.env.local`

---

## Additional Variables (for Existing Workflows)

### Slack Integration
```bash
# Not needed as env var if using OAuth2 credential
# Set up via n8n Credentials → Slack OAuth2
```

### OpenAI (for AI Agents)
```bash
OPENAI_API_KEY=sk-proj-...your_key_here
```
**Where to get:**
1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Go to API Keys → Create new secret key

### Calendly
```bash
# Not needed as env var if using OAuth2 credential
# Set up via n8n Credentials → Calendly OAuth2
```

### Gmail
```bash
# Not needed as env var if using OAuth2 credential
# Set up via n8n Credentials → Gmail OAuth2
```

---

## Security Best Practices

### 1. Never Commit Secrets to Git
Add to `.gitignore`:
```
.env
.env.local
.env*.local
```

### 2. Rotate Credentials Regularly
- **LinkedIn Cookie:** Expires ~1 year, rotate annually
- **API Tokens:** Rotate every 90 days (recommended)
- **N8N_INGEST_SECRET:** Rotate if suspected leak

### 3. Use OAuth2 When Possible
Instead of storing tokens as environment variables, use n8n's built-in OAuth2 credentials:
- ✅ Automatic token refresh
- ✅ Secure storage (encrypted at rest)
- ✅ Easier management

**Services with n8n OAuth2 support:**
- Google (Sheets, Contacts, Gmail, Drive)
- Slack
- Microsoft (Outlook, OneDrive, Teams)
- Calendly
- Many more...

---

## Validation Checklist

Before activating workflows, verify:

- [ ] `APIFY_TOKEN` is valid (test in browser: `https://api.apify.com/v2/users/me?token=YOUR_TOKEN`)
- [ ] `FACEBOOK_PROFILE_URL` is accessible
- [ ] `FACEBOOK_GROUP_UIDS` is valid JSON array format
- [ ] `LINKEDIN_COOKIE` is from logged-in session
- [ ] `LINKEDIN_PROFILE_URL` is your profile
- [ ] `APP_BASE_URL` matches your deployed URL
- [ ] `N8N_INGEST_SECRET` matches value in Next.js `.env.local`

---

## Testing Environment Variables

Create a test workflow in n8n Cloud:

```javascript
// Code node to test env vars
return [{
  json: {
    apify_token: $env.APIFY_TOKEN ? 'Set' : 'Missing',
    facebook_profile: $env.FACEBOOK_PROFILE_URL ? 'Set' : 'Missing',
    linkedin_cookie: $env.LINKEDIN_COOKIE ? 'Set' : 'Missing',
    app_base_url: $env.APP_BASE_URL ? 'Set' : 'Missing',
    ingest_secret: $env.N8N_INGEST_SECRET ? 'Set' : 'Missing',
  }
}];
```

Expected output:
```json
{
  "apify_token": "Set",
  "facebook_profile": "Set",
  "linkedin_cookie": "Set",
  "app_base_url": "Set",
  "ingest_secret": "Set"
}
```

---

## Troubleshooting

### Error: "Cannot read property 'APIFY_TOKEN' of undefined"
**Solution:** Environment variable not set. Go to Settings → Environments → Add Variable.

### Error: "Unauthorized" from Apify
**Solution:** Check `APIFY_TOKEN` is correct. Test in browser or Postman first.

### Error: "Invalid cookie" from LinkedIn scraper
**Solution:** 
1. Log out of LinkedIn
2. Log back in
3. Get fresh `li_at` cookie value
4. Update in n8n Cloud

### Error: "401 Unauthorized" when POSTing to ingest API
**Solution:** 
1. Check `N8N_INGEST_SECRET` matches in both n8n Cloud and Next.js
2. Ensure Authorization header format: `Bearer YOUR_SECRET`
3. Check `APP_BASE_URL` is correct (no trailing slash)

---

## Migration Notes

### Railway → n8n Cloud Changes:

**OLD (Railway):**
- Environment variables set via Railway dashboard
- Accessed via `process.env.VARIABLE_NAME`

**NEW (n8n Cloud):**
- Environment variables set via n8n Cloud → Settings → Environments
- Accessed via `$env.VARIABLE_NAME` in workflows

**No code changes needed!** n8n's expression syntax (`$env.VARIABLE_NAME`) works the same way.

---

## Next.js App Environment Variables

Your Next.js app needs these in `.env.local`:

```bash
# n8n Cloud Webhook URLs (update after migration)
N8N_WRM001_WEBHOOK_URL=https://your-workspace.app.n8n.cloud/webhook/wrm-001-facebook
N8N_WRM002_WEBHOOK_URL=https://your-workspace.app.n8n.cloud/webhook/wrm-002-google-contacts
N8N_WRM003_WEBHOOK_URL=https://your-workspace.app.n8n.cloud/webhook/wrm-003-linkedin

# Webhook Authentication (must match n8n Cloud)
N8N_INGEST_SECRET=your_secure_random_secret_here

# Database
DATABASE_URL=your_postgres_connection_string

# Existing variables (keep as-is)
# ... your other environment variables
```

---

## Summary

**Total Variables Needed:** 7
1. `APIFY_TOKEN`
2. `FACEBOOK_PROFILE_URL`
3. `FACEBOOK_GROUP_UIDS`
4. `LINKEDIN_COOKIE`
5. `LINKEDIN_PROFILE_URL`
6. `APP_BASE_URL`
7. `N8N_INGEST_SECRET`

**Setup Time:** ~15 minutes

**Security Level:** Medium-High (uses OAuth2 where possible, secure API tokens for others)

---

For more help, see: [n8n-cloud-migration-guide.md](../docs/n8n-cloud-migration-guide.md)
