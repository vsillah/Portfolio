# How Audit & Client Inputs Tie Into Sales and the Codebase

This document explains how the **AI & Automation Audit** (and other client inputs) flow into the sales process and where that data is leveraged across the application.

---

## 1. Where audit data comes from

| Source | Route / flow | Stored in | Notes |
|--------|----------------|-----------|--------|
| **Standalone audit form** | `/tools/audit` → `POST /api/tools/audit/start`, `PUT /api/tools/audit/update` | `diagnostic_audits` | Same 6 categories as chat diagnostic. `audit_type = 'standalone'`. No contact link unless we add optional email capture. |
| **Chat diagnostic** | Chat → diagnostic mode → n8n webhook → completion | `diagnostic_audits` | `audit_type = 'chat'`. On completion, if visitor email exists, app links audit to `contact_submissions` and triggers completion webhook. |
| **In-person diagnostic** | Admin → Sales conversation → In-Person Diagnostic panel | `diagnostic_audits` | `audit_type = 'in_person'`. Created from `/api/admin/sales/in-person-diagnostic` and linked to `sales_sessions`. |

All three write the same category payloads: **business_challenges**, **tech_stack**, **automation_needs**, **ai_readiness**, **budget_timeline**, **decision_making**, plus **diagnostic_summary**, **key_insights**, **recommended_actions**, **urgency_score**, **opportunity_score**.

---

## 2. How audit inputs tie into the sales process

1. **Sales Dashboard** (`/admin/sales`)
   - Lists **completed** `diagnostic_audits` (from any source).
   - Admin can filter by urgency/opportunity and open an audit to start a sales session.
   - **Code:** `GET /api/admin/sales` reads `diagnostic_audits` (status = completed) and enriches with `contact_submissions` where `contact_submission_id` is set.

2. **Sales session from an audit** (`/admin/sales/[auditId]`)
   - Full walkthrough: scripts, bundles, value evidence, proposal.
   - **Audit data is used for:** script generation (talking points, discovery questions, closing strategies), bundle/line-item selection, value report attachment, and proposal context.
   - **Code:** `app/admin/sales/[auditId]/page.tsx` loads audit via `/api/admin/sales?status=completed`, then passes `business_challenges`, `tech_stack`, `automation_needs`, `ai_readiness`, `budget_timeline`, `decision_making` into generate-step and proposal flows.

3. **Conversation without prior audit** (`/admin/sales/conversation/[sessionId]`)
   - Admin can attach an existing audit by ID (e.g. a standalone audit) so the conversation has diagnostic context.
   - **Code:** `app/admin/sales/conversation/[sessionId]/page.tsx` fetches audit by `diagnosticAuditId` from `/api/chat/diagnostic?auditId=...` and uses it for insights and script context.

4. **Diagnostic completion webhook**
   - When a **chat** diagnostic completes, the app calls **N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL** with `diagnosticAuditId`, `diagnosticData`, and contact info for sales follow-up.
   - Standalone audits do **not** trigger this webhook today (no completion webhook call in `/api/tools/audit/update`).

5. **Linking audit to contact**
   - If `diagnostic_audits.contact_submission_id` is set, the audit appears alongside that lead in outreach, value evidence, and funnel analytics.
   - **Chat:** linked automatically when visitor email matches a `contact_submissions` row.
   - **Standalone:** not linked unless we add optional email capture and upsert/link logic.

---

## 3. Where client input (audit + other) is leveraged in the codebase

| Area | What uses client input | Relevant code / API |
|------|-------------------------|----------------------|
| **Sales Dashboard** | Completed diagnostics (urgency, opportunity, contact) | `app/admin/sales/page.tsx`, `app/api/admin/sales/route.ts` |
| **Sales walkthrough** | Audit categories for script generation, bundle/proposal | `app/admin/sales/[auditId]/page.tsx`, `app/api/admin/sales/generate-step/route.ts`, `app/api/proposals/route.ts` |
| **Conversation page** | Attached audit for insights and script context | `app/admin/sales/conversation/[sessionId]/page.tsx`, `app/api/chat/diagnostic/route.ts` |
| **In-person diagnostic** | Save/load audit; generate insights from GPT | `app/api/admin/sales/in-person-diagnostic/route.ts`, `app/api/admin/sales/in-person-diagnostic/generate-insights/route.ts` |
| **Lead pipeline / outreach** | Leads with completed audit (contact_submission_id); scoring | `app/api/admin/outreach/leads/route.ts` (joins diagnostic_audits), `app/admin/outreach/page.tsx` |
| **Lead dashboards** | Lead-stage dashboard by diagnostic_audit_id | `lib/client-dashboard.ts` (`getLeadDashboardData`), `app/api/admin/lead-dashboard/route.ts` |
| **Value evidence** | Extract leads with diagnostic; suggest pricing by contact | `app/api/admin/value-evidence/extract-leads/route.ts`, `app/api/admin/value-evidence/suggest-pricing/route.ts`, reports by contact |
| **Proposals** | Session’s diagnostic_audit (e.g. org_type for tier logic) | `app/api/proposals/route.ts` (diagnostic_audit org_type) |
| **Pricing / custom** | Diagnostic data for session when building custom pricing | `app/api/pricing/custom/route.ts` |
| **Client projects** | Backfill contact_submission_id from diagnostic for dashboard | `app/api/client-projects/route.ts` |
| **Funnel analytics** | Diagnostic counts and conversion stages | `lib/funnel-analytics.ts` |
| **n8n / chat** | Diagnostic webhook payload (diagnosticData, contactInfo) | `lib/n8n.ts` (`triggerDiagnosticCompletionWebhook`), `app/api/chat/route.ts` |
| **Onboarding templates** | Future: recommended_actions from diagnostic | `lib/onboarding-templates.ts` (comment) |
| **Acceleration / recs** | Diagnostic or contact for recommendations | `app/api/webhooks/n8n/generate-acceleration-recs/route.ts` |

---

## 4. Standalone audit: current gap and options

- **Gap:** Standalone audits (`/tools/audit`) are stored in `diagnostic_audits` and appear on the Sales Dashboard, but they have **no contact link** (`contact_submission_id = null`). So they show as “unattributed” in the dashboard and do not appear in Lead Pipeline → All Leads or in outreach by contact.
- **Options to leverage standalone audit in sales:**
  1. **Optional email on completion:** At the end of the audit results page, add an optional “Get a follow-up” or “Share with our team” that captures email, upserts `contact_submissions`, links `diagnostic_audits.contact_submission_id`, and optionally calls the diagnostic completion webhook so n8n can run the same follow-up flow as for chat.
  2. **Admin entry by audit ID:** Sales already can open any audit from the dashboard; admins can start a session from a standalone audit and manually associate or create a contact if needed.
  3. **Completion webhook for standalone:** Call the same N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL when a standalone audit is completed (with or without contact link) so n8n can notify or queue follow-up.

---

## 5. Single reference: diagnostic_audits columns used by sales

- **id** — Used in Sales Dashboard and `/admin/sales/[auditId]`, conversation attach.
- **contact_submission_id** — Links audit to lead; used by outreach, value evidence, lead dashboard, funnel.
- **status** — `completed` audits appear on Sales Dashboard.
- **urgency_score**, **opportunity_score** — Display and filter on dashboard.
- **business_challenges** … **decision_making** — Full category payload for script generation, walkthrough UI, value/pricing context.
- **diagnostic_summary**, **key_insights**, **recommended_actions** — Shown in walkthrough and can drive n8n/onboarding later.
- **audit_type** — `standalone` | `chat` | `in_person` for filtering or reporting.

This doc should be updated when new features consume diagnostic or contact input (e.g. onboarding templates using recommended_actions, or standalone audit email capture).
