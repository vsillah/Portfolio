# n8n Variables Setup Guide

> **Note:** The local self-hosted instance (free plan) does NOT support Settings → Variables. Use **Credentials** instead. n8n Cloud DOES support Variables — use the instructions below when setting up n8n Cloud.

## Using n8n Variables (n8n Cloud)

### Step 1: Access Variables
1. In n8n Cloud UI, go to **Settings** → **Variables** (or **External Secrets**)
2. Click **"Add Variable"** or **"Create New"**

### Step 2: Add Each Variable

Create these variables one by one:

| Variable Name | Example Value | Description |
|--------------|---------------|-------------|
| `APIFY_TOKEN` | `apify_api_xxxxx` | Your Apify API token from console.apify.com |
| `N8N_INGEST_SECRET` | `abc123randomsecret` | Random secret (generate with: `openssl rand -hex 32`) |
| `APP_BASE_URL` | `https://yourdomain.com` | Your portfolio URL |
| `FACEBOOK_PROFILE_URL` | `https://facebook.com/yourprofile` | Your FB profile URL |
| `FACEBOOK_GROUP_UIDS` | `["123456789"]` | JSON array of FB group IDs |
| `LINKEDIN_PROFILE_URL` | `https://linkedin.com/in/yourname` | Your LinkedIn URL |
| `LINKEDIN_COOKIE` | `AQEDARxxxxxx` | li_at cookie from browser |
| `GOOGLE_CONTACTS_TOKEN` | `ya29.xxxxx` | OAuth token (see below) |

### Step 3: Update Workflows to Use Variables

In your workflows, change all expressions from:
```javascript
$env.APIFY_TOKEN
```

To:
```javascript
$vars.APIFY_TOKEN
```

I can help you update the three workflows if needed.

---

## Alternative: Docker Environment Variables

If you're running n8n via Docker, you can set env vars in your Docker Compose file or Docker run command.

### Docker Compose
```yaml
services:
  n8n:
    environment:
      - APIFY_TOKEN=your_token
      - N8N_INGEST_SECRET=your_secret
      # ... etc
```

### Docker Run
```bash
docker run -d \
  -e APIFY_TOKEN=your_token \
  -e N8N_INGEST_SECRET=your_secret \
  n8nio/n8n
```

---

## Getting Required Tokens

### APIFY_TOKEN
1. Go to https://console.apify.com/account/integrations
2. Copy your Personal API token
3. Paste into n8n Variables as `APIFY_TOKEN`

### N8N_INGEST_SECRET
Generate a random secret:
```bash
openssl rand -hex 32
```
Use this same value in:
- n8n Variables as `N8N_INGEST_SECRET`
- Your Next.js `.env` file as `N8N_INGEST_SECRET=same_value_here`

### LINKEDIN_COOKIE
1. Open LinkedIn in your browser
2. Press F12 → Application tab → Cookies → linkedin.com
3. Find `li_at` cookie and copy its value
4. Paste into n8n Variables as `LINKEDIN_COOKIE`

### GOOGLE_CONTACTS_TOKEN
**Option A: Use n8n OAuth2 Credential (Recommended)**
1. Go to Credentials → Add Credential → Google OAuth2 API
2. Set scope: `https://www.googleapis.com/auth/contacts.readonly`
3. Use the credential in the HTTP Request node

**Option B: Manual Token**
1. Go to https://developers.google.com/oauthplayground
2. Select "People API v1" → `https://www.googleapis.com/auth/contacts.readonly`
3. Click "Authorize APIs"
4. Click "Exchange authorization code for tokens"
5. Copy the access_token

---

## Next Steps

1. Add all variables to n8n Variables
2. Add `N8N_INGEST_SECRET` to your Next.js `.env` file
3. Update the three workflows to use `$vars` instead of `$env`
4. Activate the workflows
5. Test by triggering the webhooks manually

Let me know if you need help updating the workflows!
