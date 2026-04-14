# In-app generation for Lead Pipeline message queue

## Overview

Add a server-side path that uses the existing `email_cold_outreach` system prompt + OpenAI (same pattern as `lib/delivery-email.ts`) to insert rows into `outreach_queue`, exposed via admin API and UI alongside the existing n8n (WF-CLG-002) trigger.

## Current state

- Drafts live in `outreach_queue` (`contact_submission_id`, `channel`, `body` required; `subject` optional for LinkedIn; `status` defaults to `draft`).
- The app today **only triggers** n8n via `triggerOutreachGeneration` (`POST /api/admin/outreach/leads/[id]/generate`); n8n is expected to insert drafts.
- **`system_prompts.key = 'email_cold_outreach'`** (Saraev) expects `{{research_brief}}`, `{{social_proof}}`, `{{sender_name}}`, JSON `{ "subject", "body" }`.
- `generateDeliveryDraft` in `lib/delivery-email.ts` implements the LLM pattern: `getSystemPrompt`, tiered `buildResearchBrief` + `buildSocialProof`, OpenAI `response_format: json_object`, `recordOpenAICost`.

## Implementation (core)

1. **Extract** `fetchContactEnrichment`, `fetchDiagnosticContext`, `fetchValueReportContext`, `buildResearchBrief`, `buildSocialProof` into `lib/lead-research-context.ts` (export e.g. `loadLeadResearchBrief(contactId)`). **Refactor** `generateDeliveryDraft` to import from that module.
2. **`lib/outreach-queue-generator.ts`**: load lead (guards `do_not_contact`, `removed_at`), build brief + optional meeting summary, `getSystemPrompt('email_cold_outreach')`, token substitution, OpenAI, **`insert` into `outreach_queue`**, `recordOpenAICost`. Set `is_test_data` from lead.
3. **`POST /api/admin/outreach/leads/[id]/generate-in-app`** — `verifyAdmin` only. Body: optional `sequence_step`, `force`, `meeting_summary`. Skip if draft exists for same contact + `channel=email` + step unless `force`.
4. **UI** — “Generate draft (in app)” on `app/admin/outreach/page.tsx` next to existing n8n Generate.
5. **`docs/admin-sales-lead-pipeline-sop.md`** — document in-app path, `OPENAI_API_KEY`, parity note vs n8n, send still via WF-CLG-003.
6. **Vitest** — mock OpenAI + Supabase insert.

## Out of scope (follow-ups)

- LinkedIn drafts (new prompt + `subject: null`).
- Auto-fallback when `N8N_CLG002_WEBHOOK_URL` unset.
- `contact_communications` write-behind for drafts unless product wants pre-send timeline.

---

## CTO review (2026-04-14) — incorporated

**Verdict:** Revise slightly, then ship in **phases** (MVP first).

### Risks to address before / during implementation

| Risk | Mitigation |
|------|------------|
| Schema / RLS / wrong insert | Before coding insert: `information_schema` on `outreach_queue` (NOT NULL, CHECK, defaults). Confirm service-role path matches how n8n writes. |
| Prompt parity n8n vs app | Document in SOP + code comment: which fields/tokens match WF-CLG-002 vs app-only (e.g. meeting summary injection). |
| Idempotency races (double-click) | Prefer **409/422** when skip-without-force; consider DB **unique partial index** later if duplicates appear in production. |
| Cost / prompt injection | **Cap length** of `meeting_summary` server-side; reject or truncate extreme payloads. |
| Error UX | Generic JSON errors to client; **server logs** with `lead_id`, `sequence_step`, `force`, model, usage, skip reason. |

### Recommended execution order (tweaked)

1. **Discovery freeze:** Document `outreach_queue` row shape n8n creates vs app will create; token map for `email_cold_outreach`.
2. **`lib/lead-research-context.ts`** + refactor **`generateDeliveryDraft`**.
3. **`lib/outreach-queue-generator.ts`** + **`POST .../generate-in-app`** with structured outcomes: `created` \| `skipped` \| error (generic message).
4. **Vitest** before or immediately after API.
5. **UI** (thin client).
6. **SOP** last so it matches shipped behavior.

### Optional

- **`ENABLE_IN_APP_OUTREACH_GEN`** env kill-switch without full rollback.
- **`validate sequence_step`** against DB CHECK (1–6).

### Phased cut

- **MVP:** Shared context module, generator, API with skip/force + safe insert, Vitest, minimal UI, short SOP paragraph (when to use n8n vs in-app).
- **Full:** Deeper parity tests vs n8n output fixture, unique constraint/upsert for idempotency, stricter rate limits if cost spikes.

---

## Verification

- `npm run build`, `npm run lint`, `ReadLints` on touched files.
- Manual: generate in-app → draft in Message Queue; approve/send unchanged.

## Todos

- [x] Extract lead research context; refactor `generateDeliveryDraft`
- [x] `outreach-queue-generator.ts` + insert + duplicate guard + meeting summary cap
- [x] `POST .../generate-in-app` (409 for skip, cap `meeting_summary`)
- [x] Vitest (`lib/__tests__/outreach-queue-generator.test.ts`)
- [x] UI button (**Draft in app** on All Leads)
- [x] SOP update (parity + env vars + workflow table)
