# Staging Workflow Updates Checklist

For each workflow copied into **ATAS Staging**, check and update the items below before activating.

**See also**

- [Staging Vercel ↔ n8n env sync](./staging-vercel-n8n-sync.md) — copy `N8N_*` values to Vercel staging and redeploy.
- [Staging n8n activation matrix](./staging-n8n-activation-matrix.md) — workflow IDs, MCP validation/run results, and blockers.

---

## ✅ **WF-RAG-CHAT: Public Chatbot** (HIGH PRIORITY)

**What it does:** Powers the live chat on your website.

**Needs updates:**
- [ ] **Supabase connection** — Make sure it points to your **staging/dev** Supabase project (not production).
- [ ] **OpenAI/Gemini credentials** — These are usually fine (same API keys), but verify they're using the correct account.
- [ ] **Webhook URL** — The webhook path will be different in staging (n8n auto-generates new webhook URLs per project). You'll need to grab the new URL and update your Vercel staging env vars.

**What to check:**
1. Open the workflow in n8n.
2. Find any **Supabase** nodes — click them and verify the credential name points to a **staging Supabase** credential (or create a new one for staging).
3. Find the **Webhook** trigger node — copy the webhook URL (it'll look like `https://amadutown.app.n8n.cloud/webhook/...`).
4. Save that URL — you'll need it for `N8N_DIAGNOSTIC_WEBHOOK_URL` in Vercel staging.

---

## ✅ **WF-RAG-DIAGNOSTIC: Multi-Category Assessment** (HIGH PRIORITY)

**What it does:** Powers the diagnostic/audit tool.

**Needs updates:**
- [ ] **Supabase connection** — Same as above: staging/dev database only.
- [ ] **OpenAI/Gemini credentials** — Verify correct account.
- [ ] **Webhook URL** — Copy the new webhook URL for `N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL` in Vercel staging.

**What to check:**
1. Same steps as WF-RAG-CHAT above.

---

## ✅ **WF-LMN-001: Ebook Nurture Sequence** (MEDIUM PRIORITY)

**What it does:** Sends follow-up emails after someone downloads a lead magnet.

**Needs updates:**
- [ ] **Email/Gmail node** — Change the "To" address to **your own email** (or a test email address) so staging doesn't email real customers.
- [ ] **Supabase connection** — Staging/dev database.
- [ ] **Webhook URL** — Copy for `N8N_EBOOK_NURTURE_WEBHOOK_URL`.

**What to check:**
1. Find any **Gmail** or **Email** nodes in the workflow.
2. Click each one and change the recipient to your test email.
3. Verify Supabase points to staging.

---

## ✅ **WF-SOC-001: Social Content Extraction** (MEDIUM PRIORITY)

**What it does:** Extracts social media post ideas from meeting transcripts.

**Needs updates:**
- [ ] **Supabase connection** — Staging/dev database (hardcoded in Code nodes — see below).
- [ ] **Slack notification** — Change channel from `#social-content` to a **test channel** (like `#bot-test` or `#staging-alerts`).
- [ ] **OpenAI credentials** — Verify correct account.

**⚠️ IMPORTANT:** This workflow has **hardcoded Supabase URLs** in Code nodes. You'll need to:
1. Find any **Code** nodes that say "Fetch Unprocessed Meetings" or similar.
2. Look for lines like `const SUPABASE_URL = 'https://byoriebhtbysanjhimlu.supabase.co'`.
3. Replace that URL with your **staging Supabase URL**.
4. Replace `REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY` with your **staging service role key**.

**What to check:**
1. Search the workflow for "Supabase" or "SUPABASE_URL".
2. Update any hardcoded URLs/keys in Code nodes.
3. Find the **Slack** node and change the channel to a test channel.

---

## ✅ **WF-SOC-002: Social Content Publish** (MEDIUM PRIORITY)

**What it does:** Publishes social media posts to LinkedIn (and eventually Instagram/Facebook).

**Needs updates:**
- [ ] **Slack notification** — Change channel from `#social-content` to a **test channel**.
- [ ] **LinkedIn credentials** — Either:
  - Use **test LinkedIn credentials** (if you have a test LinkedIn page), OR
  - **Disable this workflow** in staging (it will try to post to LinkedIn, which you probably don't want in staging).
- [ ] **Supabase connection** — Staging/dev database (hardcoded in Code nodes — same issue as WF-SOC-001).

**⚠️ IMPORTANT:** Same hardcoded Supabase issue as WF-SOC-001. Update Code nodes.

**What to check:**
1. Update hardcoded Supabase URLs/keys in Code nodes.
2. Change Slack channel to test channel.
3. Decide: **test LinkedIn credentials** or **disable workflow** in staging.

---

## ✅ **WF-PROV: Provisioning Reminder** (LOW PRIORITY)

**What it does:** Sends reminders to clients about pending provisioning items.

**Needs updates:**
- [ ] **Slack node** — The workflow sends to whatever channel is passed in the webhook payload. Make sure your **staging app** passes a **test channel** when calling this webhook.
- [ ] **Email node** — The workflow calls a callback URL for email. Make sure that callback points to a **test email endpoint** or your own email.

**What to check:**
1. This one is mostly safe — it uses dynamic channels/emails from the webhook payload.
2. Just verify that when your **staging app** calls this webhook, it passes test values.

---

## Summary: Quick Priority Guide

| Workflow | Priority | Main Risk | Quick Fix |
|----------|----------|-----------|-----------|
| **WF-RAG-CHAT** | 🔴 HIGH | Wrong database | Update Supabase credential |
| **WF-RAG-DIAGNOSTIC** | 🔴 HIGH | Wrong database | Update Supabase credential |
| **WF-LMN-001** | 🟡 MEDIUM | Emails real customers | Change email recipient |
| **WF-SOC-001** | 🟡 MEDIUM | Wrong database + Slack spam | Update Code nodes + Slack channel |
| **WF-SOC-002** | 🟡 MEDIUM | Posts to LinkedIn + Slack spam | Update Code nodes + Slack channel + disable or use test LinkedIn |
| **WF-PROV** | 🟢 LOW | Mostly safe | Verify test channels in webhook payloads |

---

## After Updates: Activate Workflows

Once you've made the changes:
1. **Save** each workflow.
2. **Toggle the switch** to activate it (the workflow should turn green/active).
3. **Copy the webhook URLs** from each active workflow.
4. **Update your Vercel staging environment variables** with the new webhook URLs.

---

*Last updated: 2026-03-20*
