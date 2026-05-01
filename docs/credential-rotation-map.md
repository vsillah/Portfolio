# Credential Rotation Map

Use this doc when rotating credentials to avoid missing a plug-in point. Each credential lists where it's used and what to update.

---

## Next.js App (.env.local)

### N8N_INGEST_SECRET

**Used by:** All n8n workflows that POST to the app. Must match the value in n8n.

| Location | File | Purpose |
|----------|------|---------|
| Ingest endpoints | `app/api/admin/outreach/ingest/route.ts` | Warm/cold lead scrapers (WRM-001/002/003, CLG) |
| | `app/api/admin/value-evidence/ingest/route.ts` | Pain point evidence (VEP-001/002) |
| | `app/api/admin/value-evidence/ingest-market/route.ts` | Raw market data (VEP-002) |
| | `app/api/admin/cost-events/ingest/route.ts` | Cost event ingest |
| Cron / n8n triggers | `app/api/cron/drive-sync/route.ts` | Drive sync cron |
| | `app/api/cron/gamma-stuck-cleanup/route.ts` | WF-GAMMA-CLEANUP: stuck `gamma_reports` cleanup |
| | `app/api/video-context/route.ts` | Video personalization (admin or n8n) |
| | `app/api/meetings/[id]/promote-tasks/route.ts` | WF-MCH meeting complete |
| | `app/api/client-email-context/route.ts` | Email context for n8n |
| | `app/api/client-update-drafts/route.ts` | Draft updates from n8n |
| Webhooks | `app/api/webhooks/n8n/milestone-notify/route.ts` | Milestone notifications |
| | `app/api/webhooks/n8n/generate-acceleration-recs/route.ts` | Acceleration recs |
| | `app/api/webhooks/n8n/generate-dashboard-tasks/route.ts` | Dashboard tasks |

**Rotate:** Update `.env.local` and every n8n workflow that sends `Authorization: Bearer <secret>` to these endpoints.

---

### GOOGLE_SERVICE_ACCOUNT_KEY

| Location | File | Purpose |
|----------|------|---------|
| Drive sync | `lib/google-drive.ts` | Google Drive API (scripts folder) |
| | `app/api/admin/video-generation/sync-drive/route.ts` | Admin sync trigger |
| | `app/api/cron/drive-sync/route.ts` | Cron sync |

**Rotate:** Create new key in Google Cloud Console, update `.env.local`, redeploy.

---

### GOOGLE_DRIVE_SCRIPTS_FOLDER_ID

| Location | File | Purpose |
|----------|------|---------|
| | `app/api/admin/video-generation/sync-drive/route.ts` | Target folder for scripts |
| | `app/api/cron/drive-sync/route.ts` | Same |

**Rotate:** Not a secret; only change if you move the folder.

---

### HEYGEN_API_KEY, HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID, HEYGEN_TEMPLATE_ID, HEYGEN_BRAND_VOICE_ID

| Location | File | Purpose |
|----------|------|---------|
| | `lib/heygen.ts` | Avatars, templates, brand voices, video generation, status |
| | `app/api/admin/video-generation/generate/route.ts` | Generate video |
| | `app/api/admin/video-generation/queue/[id]/generate/route.ts` | Queue job |
| | `app/api/admin/video-generation/ideas-queue/[id]/generate/route.ts` | Ideas queue job |

**Template mode:** When `HEYGEN_TEMPLATE_ID` is set, uses Template API with Brand Glossary (`HEYGEN_BRAND_VOICE_ID`) instead of direct avatar. AmaduTown branding (pronunciation, terminology, tone) applied via Brand Glossary.

**Rotate:** HeyGen dashboard → regenerate key; update `.env.local`, redeploy.

---

### STRIPE_WEBHOOK_SECRET

| Location | File | Purpose |
|----------|------|---------|
| | `app/api/payments/webhook/route.ts` | Stripe webhook verification |

**Rotate:** Stripe Dashboard → Webhooks → new signing secret; update `.env.local`, redeploy.

---

### BUSINESS_FROM_EMAIL, BUSINESS_REPLY_TO_EMAIL, ADMIN_NOTIFICATION_EMAIL, AUTOMATION_INBOUND_EMAIL

| Location | File | Purpose |
|----------|------|---------|
| | `lib/business-email-config.ts` | Client-facing email identity and role inbox routing |
| | `lib/email/deliver-transactional.ts` | Sender and reply-to values for transactional delivery |

**Rotate:** Update the env values and redeploy. Keep these separate from transport credentials so a provider swap does not change the public sender identity.

---

### GMAIL_USER, GMAIL_APP_PASSWORD

| Location | File | Purpose |
|----------|------|---------|
| | `lib/email/deliver-transactional.ts` | Gmail SMTP transport fallback credentials |

**Rotate:** Google Account → App passwords; update `.env.local`, redeploy. During the AmaduTown branded-email migration, this account may be a transport credential while `BUSINESS_FROM_EMAIL` remains the client-facing sender.

---

### LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET

| Location | File | Purpose |
|----------|------|---------|
| | `app/api/auth/linkedin/route.ts` | OAuth initiation |
| | `app/api/auth/linkedin/callback/route.ts` | OAuth callback |

**Rotate:** LinkedIn Developer Portal; update `.env.local`, redeploy.

---

### PRINTFUL_API_KEY

| Location | File | Purpose |
|----------|------|---------|
| | `app/api/admin/printful/test-connection/route.ts` | Test connection |
| | `app/api/webhooks/printful/route.ts` | Printful webhook |

**Rotate:** Printful dashboard; update `.env.local`, redeploy.

---

### OPENAI_API_KEY, ANTHROPIC_API_KEY

| Location | File | Purpose |
|----------|------|---------|
| | `lib/llm-judge.ts` | LLM judge / evaluation |
| | `app/api/admin/sales/in-person-diagnostic/generate-insights/route.ts` | Diagnostic insights |

**Rotate:** Respective dashboards; update `.env.local`, redeploy.

---

### GITHUB_TOKEN

| Location | File | Purpose |
|----------|------|---------|
| | `lib/module-sync-db.ts` | Module sync |
| | `app/api/admin/module-sync/create-repo/route.ts` | Create repo |
| | `app/api/admin/module-sync/push/route.ts` | Push to repo |

**Rotate:** GitHub → Settings → Developer settings → Personal access tokens; update `.env.local`, redeploy.

---

### Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)

Used by `lib/supabase.ts` and many API routes. Supabase service role key is in `.env.local` and in n8n Code nodes (see below).

**Rotate:** Supabase Dashboard → Settings → API; update `.env.local` and all n8n workflows that use it.

---

## n8n Workflows

Credentials in n8n are either hardcoded in nodes or in n8n Credentials. When rotating, update each workflow that uses the credential.

### Google Gemini API Key

| Workflow | Usage |
|----------|-------|
| WF-SOC-001 (Social Content Extraction) | `generativelanguage.googleapis.com` query param `key` |

**Rotate:** Replace in Gemini Image Gen node (query param).

---

### ElevenLabs API Key (xi-api-key)

| Workflow | Usage |
|----------|-------|
| WF-SOC-001 (Social Content Extraction) | ElevenLabs HTTP header `xi-api-key` |

**Rotate:** Replace in ElevenLabs Voiceover node (header).

---

### Apify API Token

| Workflow | Usage |
|----------|-------|
| WF-WRM-001 (Facebook) | Apify URL token param, ingest POST |
| WF-WRM-003 (LinkedIn) | Same |
| WF-VEP-002 (Social Listening) | HTTP header `Authorization: Bearer` |
| WF-MON-001 (Apify Health Monitor) | HTTP header + Code node |
| WF-CLG-001 (Cold Lead Sourcing) | HTTP header |

**Rotate:** Apify Console → Settings → Integrations → API; update each workflow or n8n Credential.

---

### Supabase Service Role Key

| Workflow | Usage |
|----------|-------|
| WF-SOC-001 (Social Content Extraction) | Code nodes: Fetch Unprocessed Meetings, Insert to Queue |
| WF-SOC-002 (Social Content Publish) | Code nodes: Fetch content, Update published |
| WF-CLG-004 (Reply Detection) | Code node: Cancel outreach items |

**Rotate:** Supabase Dashboard; update each Code node's `SUPABASE_KEY` constant.

---

### N8N_INGEST_SECRET (in n8n)

| Workflow | Usage |
|----------|-------|
| WF-WRM-001, WF-WRM-002, WF-WRM-003 | HTTP header `Authorization: Bearer` to ingest |
| WF-VEP-002 | Code node `secret` in Parse and POST Results |
| WF-CLG-001 (and others) | Similar ingest POSTs |

**Rotate:** Update `.env.local` and every n8n workflow that POSTs to ingest endpoints (see above).

---

### Google Contacts Token

| Workflow | Usage |
|----------|-------|
| WF-WRM-002 (Google Contacts Sync) | OAuth or Bearer token |

**Rotate:** Usually via n8n Credentials (OAuth2); refresh in n8n Credentials UI.

---

### Other n8n Credentials

- **Slack** — OAuth2 credential
- **Gmail** — OAuth2 credential
- **Calendly** — OAuth2 credential
- **LinkedIn** — Cookie or OAuth (WF-WRM-003)
- **Anthropic** — HTTP Header Auth (WF-VEP-002)

Rotate via n8n Credentials UI or by updating the respective workflow nodes.

---

## Quick Rotation Checklist

When rotating a credential:

1. [ ] Identify all locations in this doc
2. [ ] Update `.env.local` (if applicable)
3. [ ] Update n8n workflows (nodes or Credentials)
4. [ ] Redeploy or restart the app
5. [ ] Test one flow that uses the credential

---

## Related Docs

- [n8n workflow backup strategy](./n8n-workflow-backup.md)
- [n8n environment variables reference](../n8n-exports/environment-variables-reference.md)
