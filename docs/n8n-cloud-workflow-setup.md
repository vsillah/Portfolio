# n8n Cloud — Workflow Setup Notes

Brief setup and validation notes as we migrate/validate workflows on n8n Cloud (`amadutown.app.n8n.cloud`).

**Cutover (2026-02-25):** my-portfolio now uses n8n Cloud by default. `N8N_BASE_URL` and all `N8N_*_WEBHOOK_URL` in `.env.local` point to `https://amadutown.app.n8n.cloud`. To use self-hosted n8n, set `N8N_BASE_URL=https://n8n.amadutown.com` and update per-workflow URLs.

## Completed / Reviewed

| Workflow | Status | Notes |
|----------|--------|-------|
| ATAS Onboarding Plan Email Delivery | ✅ | HTTP nodes documented; mock payload + trigger script |
| Client Progress Update Router | ✅ | Webhook body: use `$json.body.*` |
| Lead Research and Qualifying Agent | ✅ | Route by Score fixed (gte/lt); seed script for test row 99999; mock payload email aligned |
| RAG Chatbot for AmaduTown using Google Gemini | ✅ | See below |
| ReversR Beta Tester Intake form | ✅ | Value mappings + credential; trigger script injects current timestamp |
| WF-DIAG-COMP: Diagnostic Completion | ✅ | Webhook `diagnostic-completion` → Slack → Respond `{ ok: true }`; ID `jpSUzUCkbwCrkTSy` |
| WF-GAMMA-CLEANUP: Stuck Gamma Reports | ✅ | Schedule hourly → `POST /api/cron/gamma-stuck-cleanup` (Bearer `N8N_INGEST_SECRET`); ID `V5cNpHrAgSqd05NC`; set `PORTFOLIO_URL` + `N8N_INGEST_SECRET` in n8n Variables |

## Chat / RAG (split workflows)

The former monolithic RAG Chatbot was split into logical chunks. The app calls n8n via these env vars; set each to the **production webhook URL** of the corresponding workflow on n8n Cloud.

| Env var | Purpose | Payload shape | If unset |
|---------|---------|---------------|----------|
| **N8N_WEBHOOK_URL** | Main chat (site chat + health check) | `POST` JSON: `{ action: 'sendMessage', sessionId, chatInput, history?, ... }` | Chat uses smart fallback; health check fails |
| **N8N_DIAGNOSTIC_WEBHOOK_URL** | Diagnostic / audit chat | Same as above + `diagnosticMode: true`, `diagnosticAuditId`, `currentCategory`, `progress` | Falls back to `N8N_WEBHOOK_URL` |
| **N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL** | When user completes diagnostic (notify sales) | `POST` JSON: `{ diagnosticAuditId, diagnosticData, contactInfo, completedAt, source }` — `source` is `chat_diagnostic` or `standalone_audit` | Falls back to `N8N_LEAD_WEBHOOK_URL` (avoid: use WF-DIAG-COMP) |

**Setup:** In n8n Cloud, identify the workflow (or router) that receives the chat webhook. Copy its **Production** webhook URL into `N8N_WEBHOOK_URL`. If you have a separate diagnostic workflow, set `N8N_DIAGNOSTIC_WEBHOOK_URL` to its URL. Set **`N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL`** to **WF-DIAG-COMP** production URL: `https://amadutown.app.n8n.cloud/webhook/diagnostic-completion` (test: `.../webhook-test/diagnostic-completion` when listening in the editor).

**RAG / prompt API:** Any chunk that needs the site prompt should call `GET {{ $env.PORTFOLIO_URL || 'https://amadutown.com' }}/api/prompts/chatbot` (returns `{ prompt: { prompt, config } }` from `system_prompts` table). Set `PORTFOLIO_URL` in n8n Cloud Variables if using a different origin.

**Docs:** `docs/n8n-rag-chatbot-troubleshooting.md`, `N8N_PROMPT_SYNC.md`

## ReversR Beta Tester Intake form

- **ID:** `0pcaKH26Iu7IiRAu`
- **Nodes:** 3 (Webhook → Google Sheets → Gmail)
- **Flow:** POST webhook → append/update row in "N8N Work Intake Sheet" (Intake) → send notification email
- **Webhook path:** `53e16572-06e1-476d-a261-7db59d996d53`
- **Body fields:** email, firstName, lastName, hasAndroid, interest, comfort, newsletter, innovateIdeas, comments, submittedAt, source
- **Credentials:** Google Sheets OAuth2, Gmail OAuth2
- **Test:** `./scripts/trigger-reversr-intake-webhook.sh` with `scripts/reversr-intake-mock-payload.json`

## Workflow validation order (logical chunks)

Run trigger scripts in this order. Each phase depends on the previous one being validated.

### Phase 1 — Webhook-callable (no DB seed)

| Order | Workflow | Trigger script | Status |
|-------|----------|----------------|--------|
| 1.1 | WF-FUP: Follow-Up Meeting Scheduler | `./scripts/trigger-follow-up-scheduler-webhook.sh` | ✅ |
| 1.2 | WF-TSK: Task Slack Sync | `./scripts/trigger-task-slack-sync-webhook.sh` | ✅ |
| 1.3 | WF-CLG-003: Send and Follow-Up | `./scripts/trigger-clg-003-send-webhook.sh` | ✅ |
| 1.4 | WF-MCH: Meeting Complete Handler | `./scripts/trigger-meeting-complete-webhook.sh` | ✅ |
| 1.5 | WF-DIAG-COMP: Diagnostic Completion | `./scripts/trigger-diagnostic-completion-webhook.sh` | ✅ |

### Phase 2 — Calendly router + onboarding / value evidence

| Order | Workflow | Trigger script | Prereq | Status |
|-------|----------|----------------|--------|--------|
| 2.1 | WF-CAL → WF-001B: Onboarding Call Handler | `./scripts/trigger-onboarding-call-booked-webhook.sh` | Run `scripts/seed-onboarding-test-client-project.sql` in Supabase first | ✅ |
| 2.2 | WF-VEP-001: Internal Evidence Extraction | `./scripts/trigger-vep-001-extract-webhook.sh` | — | ✅ |
| 2.3 | WF-VEP-002: Social Listening Pipeline | `./scripts/trigger-vep-002-social-webhook.sh` | — | ✅ |
| 2.4 | WF-MON-001: Apify Actor Health Monitor | (schedule trigger only) | — | Skip |

### Phase 3 — Cold lead reply + discovery / kickoff

| Order | Workflow | How to test | Status |
|-------|----------|-------------|--------|
| 3.1 | WF-CLG-004: Reply Detection and Notification | Gmail trigger; filter fixed. Full test: send real outreach via WF-CLG-003, then reply to that email | Filter ✅; E2E with real reply = manual |
| 3.2 | WF-000A: Discovery Call Booked | `./scripts/trigger-discovery-call-booked-webhook.sh` | Seed: `scripts/seed-discovery-call-test-contact.sql` | ✅ |
| 3.3 | WF-002: Kickoff Call Scheduled | `./scripts/trigger-kickoff-call-booked-webhook.sh` | Seed: `scripts/seed-kickoff-test-client-project.sql`; migrations for status CHECK + `kickoff_calendly_uri` column | ✅ (Supabase + Gmail + Slack; channelName ref fixed) |
| 3.4 | WF-000: Inbound Lead Intake | `./scripts/trigger-inbound-lead-webhook.sh` | — | ✅ triggered (200) |

### What’s next

- **Phase 3** scripted tests complete. 3.3 (WF-002 Kickoff) full flow verified: Supabase update, Gmail prep email, Slack channel create + topic + welcome message (channelName fixed to reference Extract Booking Details).
- **Optional:** Phase 3.1 E2E — send a real cold email from admin, reply to it, confirm WF-CLG-004 runs the reply branch.

## WF-CLG-002: Outreach Generation — fixes applied 2026-04

**Repo export:** `n8n-exports/WF-CLG-002-Outreach-Generation.json`
**Prod ID:** `G4A9YUNCwokMhGA8` | **STAG ID:** `3bdhN10tXpt3LbI1`

All three fixes below were applied directly to prod and STAG via `n8n_update_partial_workflow` (MCP) and mirrored in the repo export. No re-import needed; this section documents the change history.

### 1. `outreach_status` gate removed

**Problem:** The workflow had an **If** node (`Already Contacted?`: `outreach_status` equals `not_contacted`). The **false** output had **no** downstream nodes, so for leads already in another state the run “succeeded” in n8n but **never** reached **Generate Email** or **outreach_queue** — and the app never got a queue row or completion webhook.

**Change:** **Get Lead Data** → **Generate Email** and **Generate LinkedIn Message** directly; the If node and its empty false branch are removed. Every trigger now uses the same LLM + `outreach_queue` path regardless of `outreach_status`. Verified via execution #11905 for a `sequence_active` lead (drafts written, Slack fired, completion webhook acked).

**If you need a gate for scheduled runs only later:** add a **Merge** or a condition on a dedicated flag (e.g. from the webhook body) instead of hard-blocking all non-`not_contacted` leads.

### 2. AI-agent prompt expression evaluation

**Problem:** `parameters.text` on `Generate Email` and `Generate LinkedIn Message` was stored as a plain string, so n8n never evaluated `{{ $json.name }}`, `{{ $json.company }}`, etc. The LLM received the raw placeholder syntax and echoed it verbatim into the draft subject/body (e.g. `"Unlocking AI Potential at {{ $json.company }}"`).

**Change:** Prepended `=` to both `text` fields so n8n evaluates them as expressions before sending to the LLM. Verified via execution #11906: drafts now contain substituted values (e.g. `"Exploring New Opportunities with Monomoy Advisors"`, `"Hi Kyle,..."`).

**Rule of thumb for future agent nodes:** any `text`/`prompt` field that references `{{ $json... }}` or `{{ $('Node').first().json... }}` **must** start with `=`. Without it, n8n treats the whole string as a literal and the LLM hallucinates around the placeholders.

### 3. Slack node: explicit `resource` / `operation`

**Problem:** `Slack: Drafts Ready` relied on default `resource`/`operation` values, which the validator flagged as invalid (`"Invalid value for 'operation'. Must be one of: delete, getPermalink, search, post, sendAndWait, update"`). Ran fine at runtime but violated the "never trust defaults" rule.

**Change:** Added `resource: "message"` and `operation: "post"` explicitly. Validator no longer complains about missing operation; message posts correctly to `#outreach` with substituted lead fields.

## Skipped

- **HeyGen Cold Email** — No HeyGen API key

## Next (alphabetical, for reference)

- WF-000: Inbound Lead Intake
- WF-000A: Discovery Call Booked
- … (continue as needed)
