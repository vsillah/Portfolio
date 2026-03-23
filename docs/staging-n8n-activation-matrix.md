# ATAS Staging — n8n activation matrix

**n8n Cloud project:** ATAS Staging (`9JToCjbBoRUoQRkH`)  
**Inventory source:** `n8n_list_workflows` (project filter), 2026-03-20  
**Related:** [staging-vercel-n8n-sync.md](./staging-vercel-n8n-sync.md), [staging-workflow-updates-checklist.md](./staging-workflow-updates-checklist.md)

Use this table to track **activate → run → verify → deactivate** (or leave active only when safe). Update the **Last run** and **Result** columns as you complete each workflow.

## Legend

- **Trigger:** Primary entry node type (confirm in n8n if unsure).
- **Validation:** `n8n_validate_workflow` via MCP (static checks; not a substitute for a real run).
- **MCP run:** `n8n_test_workflow` where supported (webhook/form/chat only). Schedule/manual/sub-workflow triggers require **Test workflow** in the n8n editor.

## Workflow inventory and status

| Workflow | ID | Plan wave | Trigger (known) | Validation (2026-03-20) | MCP / execution notes |
|----------|-----|-----------|-----------------|-------------------------|------------------------|
| WF-PROV-STAG: Provisioning Reminder | `3XGTDE9esc6yVH0Y` | 4 | Webhook | Not run | **PASS:** POST smoke test → 200, execution `7733`; workflow **deactivated** after test |
| WF-CLG-002-STAG: Outreach Generation | `3bdhN10tXpt3LbI1` | 3 | Webhook | **FAIL:** Supabase `matchType`; Slack `operation` | Run after fixing validation errors |
| WF-WRM-003-STAG: LinkedIn Warm Lead Scraper | `6aFxQF3CKR5HZptu` | 2 | (webhook typical) | Not run | Activate only when ready for Apify/API cost |
| WF-VEP-001-STAG: Internal Evidence Extraction | `7YdqfO7rewTHICHy` | 2 | Webhook | Not run | **FAIL:** execution `7734` — **share credential** “Supabase account (Staging)” with project **ATAS Staging** in n8n; then re-test. **Deactivated** after test |
| WF-SOC-001-STAG: Social Content Extraction | `7w0m68a8ad6BkdzV` | 5 | Webhook + (schedule off) | Not run | Manual webhook first per isolation plan |
| WF-CLG-004-STAG: Reply Detection and Notification | `AxE3tBBNDOvD6ogK` | 3 | (webhook typical) | Not run | Test after CLG-002/003 stable |
| WF-CLG-001-STAG: Cold Lead Sourcing | `E9lFlMxdtnnebIFK` | 3 | Schedule | **PASS** (warnings) | **Do not** enable schedule until Hunter + ingest tested; use editor manual run |
| WF-RAG-INGEST-STAG: Google Drive → Pinecone | `FJHcf3SPDWBirqu1` | 2 | Schedule (**disabled**) | Not run | Editor manual run from first Code node / enable schedule only after Pinecone creds OK |
| WF-WRM-001-STAG: Facebook Warm Lead Scraper | `KZpTpasHMDQ3kLtG` | 2 | (webhook typical) | Not run | Prefer this ID over duplicate below |
| WF-MCH-STAG: Meeting Complete Handler | `Khph9o7IMhEXgwFW` | 4 | (webhook typical) | Not run | Use saved Calendly/Slack sample payloads |
| WF-SLK-STAG: Slack Meeting Intake | `PVpcf3FbOpP3KhkO` | 4 | (webhook typical) | Not run | |
| WF-MON-001-STAG: Apify Actor Health Monitor | `R5xVO3JBGMBjQ9f5` | 1 | Schedule + Manual | Not run | MCP cannot trigger; use editor **Manual** |
| WF-FUP-STAG: Follow-Up Meeting Scheduler | `S9CIj44mdW3tv8CH` | 4 | (webhook typical) | Not run | |
| WF-AGE-STAG: Agenda Email Sender | `TQCVwtkO9Uo8xAnJ` | 4 | (webhook typical) | Not run | |
| WF-WRM-002-STAG: Google Contacts Sync | `Tu0NeKYTpjQhYLxw` | 2 | (webhook typical) | Not run | |
| WF-VEP-002-STAG: Social Listening Pipeline | `VgDvKIZeuslJSmj8` | 2 | (webhook typical) | Not run | |
| WF-RAG-CHAT-STAG: Public Chatbot | `ZCbY39UhhreaX4Rp` | 7 | Webhook (chat-style) | **FAIL:** Code node “Process External History” | Fix before staging E2E; then align `N8N_WEBHOOK_URL` on Vercel |
| WF-GDR-STAG: Gmail Draft Reply | `ZcmmuBcI1vCEvJU7` | 4 | (webhook typical) | Not run | |
| WF-CAL-STAG: Calendly Webhook Router | `bAx1DPXUy5Hs0fJl` | 4 | Webhook | Not run | |
| WF-CLG-003-STAG: Send and Follow-Up | `c6YWuqITIeep5QZp` | 3 | Webhook | **FAIL:** Gmail/Slack `operation`; Supabase `filterString` expression | Fix before send tests |
| WF-WRM-001-STAG: Facebook Warm Lead Scraper (duplicate) | `cRMgPSkvdFVgWGh6` | — | — | Not run | **Duplicate name** — prefer `KZpTpasHMDQ3kLtG` or archive this copy in n8n |
| WF-LMN-001-STAG: Ebook Nurture Sequence | `ffiAJkNUDdF8E4G8` | 7 | Webhook | Not run | E2E from staging lead flow after Vercel env set |
| WF-RAG-QUERY-STAG: Webhook RAG Search | `gYtZQi25kxXpbHLH` | 8 | Webhook | Not run | **Activate blocked:** missing **Pinecone** credential on “Pinecone Vector Store” node |
| WF-CLG-001-STAG: Cold Lead Sourcing (archived) | `gofqa551WWsH6epg` | — | — | — | **Archived** — ignore |
| WF-RAG-DIAG-STAG: Multi-Category Assessment | `lSpWqqaOQllyYFF8` | 7 | Execute Workflow Trigger | Not run | Sub-workflow: invoked from RAG-CHAT-STAG “Execute Diagnostic” or editor |
| WF-SOC-002-STAG: Social Content Publish | `r8tYuflvnDI1UVoC` | 6 | Webhook | **FAIL:** Slack `operation`; Publish Webhook `onError` | **Last** in rollout; LinkedIn risk |
| WF-TSK-STAG: Task Slack Sync | `yW5jjL7iLkWLO6Co` | 4 | Webhook | Not run | Align `N8N_TASK_SLACK_SYNC_WEBHOOK_URL` on Vercel |

## What ran in Cursor (2026-03-20)

- **n8n MCP health:** OK (`n8n_health_check`).
- **Full webhook execute + verify:** **WF-PROV-STAG** only (POST test → success, execution `7733`); workflow left **inactive** after test.
- **WF-VEP-001-STAG:** Webhook fired → execution **`7734` error** (credential not shared with project); workflow **deactivated**.
- **WF-RAG-QUERY-STAG:** **Activation failed** (missing Pinecone credential) — no execution.
- **Static validation:** CLG-001 (pass), CLG-002 / CLG-003 / SOC-002 (fail with listed errors), RAG-CHAT (fail).
- **Not run here:** MON (manual/schedule only), full CLG chain with synthetic payloads, Calendly/Slack meeting flows, SOC-001/SOC-002 live posts, staging-site E2E for chat/diag/LMN — follow the matrix rows in n8n or on Vercel staging after blockers are fixed.

## Blockers discovered during automation (2026-03-20)

1. **VEP-001-STAG:** Staging Supabase credential exists but is **not shared** with the **ATAS Staging** project. In n8n: **Credentials → Supabase account (Staging) → Share** with the staging project (or recreate in-project).
2. **RAG-QUERY-STAG:** **Pinecone** credential missing on vector store node — add credential or copy from prod into staging-safe config.
3. **CLG-002 / CLG-003 / SOC-002:** MCP validator reports **invalid Slack/Gmail/Supabase parameter enums** and expression issues — workflows may still run in n8n if UI schema differs; treat as **must-fix** before relying on CI-style validation.
4. **RAG-CHAT-STAG:** Validator error on **Process External History** code node — fix before public staging chat test.

## Suggested order (recap)

1. Resolve **credential sharing** (Supabase staging) and **Pinecone** on RAG-QUERY.  
2. Fix **validation errors** on RAG-CHAT, CLG-002, CLG-003, SOC-002.  
3. Re-run **WF-PROV-STAG** style smoke tests, then waves 2 → 8 per the staging n8n activation plan in Cursor plans.  
4. Keep workflows **inactive** except during tests unless you explicitly want scheduled staging traffic.

## Your follow-up steps

1. In **Vercel staging**, mirror `.env.staging` into environment variables and **redeploy** ([staging-vercel-n8n-sync.md](./staging-vercel-n8n-sync.md)).  
2. In **n8n**, share staging credentials with project **ATAS Staging**; attach Pinecone where needed.  
3. Fix validator issues on the four workflows above, then re-run MCP **validate** + **test** for each webhook workflow.  
4. For **E2E wave 7** (chat, diagnostic, LMN), exercise **staging site** after env and workflows are green.
