---
name: ""
overview: ""
todos: []
isProject: false
---

# Follow-Up Meeting Scheduling + Client Email Draft Responses

**Status:** Complete
**Last updated:** 2026-02-15

---

## Overview

Two automations: (1) After each meeting, use the Calendly API in n8n to check your availability and create or propose a follow-up meeting using attendees and next_meeting_type from the meeting record. (2) When a client email arrives in Gmail, match the sender to a client project, fetch project status from the app, generate a draft reply, and **store the draft in the app** (existing `client_update_drafts` table and Client Update Drafts UI) and optionally create a Gmail draft.

---

## Implementation status


| Phase | Deliverable                                                                          | Status                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1   | App: `GET /api/meetings/[id]/follow-up-context`                                      | **DONE** — `app/api/meetings/[id]/follow-up-context/route.ts`                                                                                                            |
| 3.2   | n8n: WF-FUP — Follow-Up Meeting Scheduler                                            | **DONE** — ID: `HyVGDTStTaWYL4Do`. Validation fixes applied (URL expression, webhook onError, Calendly credential, Slack select). Inactive until credentials configured. |
| 3.3   | WF-MCH: HTTP call to WF-FUP after Parse and Store                                    | **DONE** — "Call Follow-Up Scheduler" node added to WF-MCH (ID: `94mqmLgS9GkomPIf`), connected to "Parse and Store", `onError: continueRegularOutput`.                   |
| 3.4   | App: `GET /api/client-email-context?email=...`                                       | **DONE** — `app/api/client-email-context/route.ts`                                                                                                                       |
| 3.5   | App: extend client_update_drafts — `createDraftDirect()` + POST accepts subject+body | **DONE** — `lib/client-update-drafts.ts` + `app/api/client-update-drafts/route.ts`                                                                                       |
| 3.6   | n8n: Gmail draft workflow                                                            | **DONE** — WF-GDR: Gmail Draft Reply (ID: `7dsXnjup9zi5rf8N`). Inactive until Gmail OAuth2 + OpenRouter credentials configured.                                          |
| 3.7   | Docs: meeting-follow-up guide, SOP updates                                           | **DONE** — `docs/meeting-follow-up-communications-guide.md` updated, SOP env vars updated.                                                                               |


---

## 1. Automate follow-up meeting scheduling (post-meeting)

- **Trigger:** New n8n workflow WF-FUP (HTTP), called by WF-MCH after "Parse and Store" or by admin.
- **Input:** meeting_record (attendees, next_meeting_type, next_meeting_agenda, client_project_id) and project (client_name, client_email, slack_channel).
- **App API:** `GET /api/meetings/[id]/follow-up-context` returns meeting + project for n8n. Auth: admin session or N8N_INGEST_SECRET.
- **n8n:** Parse attendees → Calendly API (create scheduling link) → notify client (Slack or Gmail draft).
- **Docs:** Updated meeting-follow-up-communications-guide.md and SOP.

---

## 2. Listen for client emails and prepare draft responses (Gmail)

- **Trigger:** n8n Gmail Trigger (new message in inbox / label). Match sender to `client_projects.client_email`.
- **App API (context):** `GET /api/client-email-context?email=...` — returns project, milestones, last meeting summary, action items for that client. Auth: ingest secret.
- **App API (create draft in app):** Drafts are stored in the app using the **existing** `client_update_drafts` table and the **existing** "Client Update Drafts" tab (Admin → Meeting Tasks). The POST endpoint now supports two modes:
  - **Mode 1 (existing):** Generate from completed tasks — `{ client_project_id, meeting_record_id?, task_ids?, custom_note? }`
  - **Mode 2 (new):** Create directly — `{ client_project_id, subject, body, client_email, client_name, source?, meeting_record_id? }`. Auth: admin session or N8N_INGEST_SECRET.
- **n8n flow:** Gmail trigger → match sender → GET client-email-context → GET /api/prompts/client_email_reply → LLM draft reply → POST to app to create draft → optionally Gmail create draft.

---

## 3. Completed n8n work (2026-02-15)

### 3.2 WF-FUP validation fixes — DONE

Applied via `n8n_update_partial_workflow`:

1. **Post to Slack** node: changed `select` to `"channel"` with resource locator format.
2. **Follow-Up Webhook** node: added `onError: "continueRegularOutput"`.
3. **Fetch Follow-Up Context** node: fixed URL expression (replaced optional chaining with concatenation).
4. **Create Calendly Scheduling Link** node: REMOVED. Replaced with a hardcoded mapping of meeting types to Calendly booking URLs in the "Parse Attendees & Build Request" code node. No Calendly API call needed — uses the 6 existing scheduling page URLs directly. Lifecycle order auto-infers the next meeting type if not explicitly set.

### 3.3 WF-MCH update — DONE

Added "Call Follow-Up Scheduler" HTTP Request node to WF-MCH:

- URL: `https://n8n.amadutown.com/webhook/follow-up-scheduler`
- Method: POST
- Body: `{ "meeting_record_id", "base_url" }`
- `onError: continueRegularOutput` (non-blocking).

### 3.6 Gmail draft workflow — DONE

Created **WF-GDR: Gmail Draft Reply** (ID: `7dsXnjup9zi5rf8N`):

1. Gmail Trigger (new unread message)
2. Extract Sender (Code node)
3. Fetch Client Context (HTTP Request to `/api/client-email-context`)
4. Is Known Client? (IF node)
5. Fetch Reply Prompt (HTTP Request to `/api/prompts/client_email_reply`)
6. Build LLM Input (Code node — combines prompt + context + email)
7. Generate Draft Reply (HTTP Request to OpenRouter)
8. Parse LLM Response (Code node)
9. Store Draft in App (HTTP Request to `/api/client-update-drafts`)
10. Create Gmail Draft (Gmail node — threaded reply)

---

## 4. Out of scope / later

- Mutual availability across two calendars (client Google Calendar): not in scope.
- Session outcome → automation: still "future automation."
- RAG 404 in WF-MCH: separate fix.

---

## 5. Existing functionality reused

- **Draft emails in the app:** [client_update_drafts](migrations/2026_02_14_meeting_action_tasks.sql) table, [lib/client-update-drafts.ts](lib/client-update-drafts.ts), [GET/POST /api/client-update-drafts](app/api/client-update-drafts/route.ts), [Client Update Drafts tab](app/admin/meeting-tasks/page.tsx) on Meeting Tasks page. Email-response drafts use the same table and UI; only the **creation** path is extended (create from subject/body, not only from completed tasks).
- **Communications prompt:** The prompt used to generate client email draft replies is configurable at **Admin → System Prompts** (key: `client_email_reply`). It is seeded with default messaging via [migrations/2026_02_15_communications_prompt.sql](migrations/2026_02_15_communications_prompt.sql). n8n can fetch it with `GET /api/prompts/client_email_reply`; the app uses `getClientEmailReplyPrompt()` from [lib/system-prompts.ts](lib/system-prompts.ts).

---

## 6. New files created

- `app/api/meetings/[id]/follow-up-context/route.ts` — Follow-up context API
- `app/api/client-email-context/route.ts` — Client email context API
- `lib/client-update-drafts.ts` — Extended with `createDraftDirect()` and `CreateDraftDirectInput` type
- `app/api/client-update-drafts/route.ts` — Extended POST with direct draft mode + webhook auth
- `docs/meeting-follow-up-communications-guide.md` — Updated with WF-FUP and Gmail draft sections

