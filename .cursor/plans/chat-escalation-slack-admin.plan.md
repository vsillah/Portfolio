# Chat Escalation: Admin UI (no new card) + Lead Link + Slack

## CTO and Lead UX Designer input (no new dashboard card)

**Constraint:** Do not add a new card to the admin dashboard. The dashboard is already overloaded.

### CTO recommendation
- **Place escalations under Lead Pipeline (Outreach)** as a third tab: "Escalations", next to "Message Queue" and "All Leads".
- **Rationale:** Primary action is "link to lead" / follow up → same place as leads; same persona (sales/admin); one mental bucket for "inbound that needs attention" (queue, leads, escalations).
- **Optional:** On Sales Dashboard, a single line "X chat escalations need attention" linking to `/admin/outreach?tab=escalations`.

### Lead UX Designer recommendation
- **Primary:** Escalations as a sub-area **under Chat Eval** (e.g. `/admin/chat-eval/escalations`) — same card as today, new list/detail inside Chat Eval. Escalations are a subset of chat sessions; workflow is list → open session → read transcript → optionally open lead.
- **Secondary:** On **lead detail** in Lead Pipeline, add "Chat escalations for this contact" linking to those sessions.
- **Rationale:** Escalations are chat data; "find all escalations" in one place; lead detail still shows escalations in context for that contact.

### Decision: Lead Pipeline tab (Option A)
- **Product owner choice:** Escalations list lives in **Lead Pipeline → Escalations tab** on `/admin/outreach`. Rationale: all chat sessions (including escalated) already appear in Chat Eval; the escalations tab in Pipeline is for *acting* on them (link to lead, follow up) in the same place as queue and leads.
- **No new dashboard card.** Entry: Admin → Lead Pipeline → Escalations tab.
- **Lead detail:** On lead detail in Outreach, show "Chat escalations for this contact" (secondary entry).
- Chat Eval continues to show escalated sessions (e.g. "Escalated" badge) and can link to the same session/transcript; no separate Escalations area under Chat Eval.

---

## Goals (unchanged)

1. Store every chat/voice escalation in the DB (`chat_escalations` table).
2. Link escalations to a lead (`contact_submission_id`); auto-link by email when possible; admin can change link.
3. Notify Slack with contact info and transcript when an escalation occurs.
4. **Admin UI as source of truth with no new dashboard card:** surface escalations in the **Lead Pipeline → Escalations** tab on `/admin/outreach`.

---

## Implementation summary

### Database
- New migration: `chat_escalations` table (session_id, escalated_at, source, reason, visitor_name, visitor_email, transcript, contact_submission_id, slack_sent_at, created_at, updated_at). Auto-link `contact_submission_id` by visitor_email when single match.

### Backend
- `lib/chat-escalation.ts`: `createChatEscalation()` — insert row, auto-link by email, call Slack helper (fire-and-forget); optionally set `slack_sent_at`.
- Call from `app/api/chat/route.ts` and `app/api/vapi/webhook/route.ts` when `escalated === true` (and on VAPI `transferToHuman`).
- APIs: `GET /api/admin/chat-escalations` (list with filters), `GET /api/admin/chat-escalations/[id]`, `PATCH /api/admin/chat-escalations/[id]` (contact_submission_id for linking).

### Admin UI (no new card)
- **Escalations tab** on `/admin/outreach`: Add third tab "Escalations" next to "Message Queue" and "All Leads". Tab shows list of escalation records; row links to escalation detail (or to Chat Eval session for full transcript if preferred). Detail view: transcript, contact info, link/unlink to lead (dropdown to select contact).
- **Lead detail:** On lead detail in Outreach, add section "Chat escalations for this contact" with links to escalation/session detail.
- **Dashboard:** No new card. Optional: Sales Dashboard can show one line "X chat escalations need attention" → link to `/admin/outreach?tab=escalations`.

### Slack
- When `createChatEscalation` runs, POST to `SLACK_CHAT_ESCALATION_WEBHOOK_URL` with contact info and transcript. Document in `.env.example` and SOP.

### Docs
- Update `docs/admin-sales-lead-pipeline-sop.md`: where to find escalations (Lead Pipeline → Escalations tab), lead linking, Slack env var.

---

## One-sentence plan (for handoff)

**Chat escalations are stored in `chat_escalations`, exposed in admin via the Escalations tab on Lead Pipeline (`/admin/outreach?tab=escalations`)—no new dashboard card—with list, detail, link-to-lead, and "Chat escalations for this contact" on lead detail; Slack is notified on each escalation with contact info and transcript.**
