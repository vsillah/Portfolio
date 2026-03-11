# Proposal-to-Client Flow — Architecture Plan

**Created:** 2026-03-10  
**Status:** Plan  
**Scope:** Send proposal in advance → access code → client auth → view → sign → pay → trigger onboarding call

---

## 1. Architecture Overview

### 1.1 Current State (What Exists)

| Component | Location | Behavior |
|-----------|----------|----------|
| **Proposals table** | `database_schema_proposals.sql`, `proposals` | Status: draft→sent→viewed→accepted→paid. Access via UUID in URL `/proposal/[id]`. **No access code.** Public view by ID. |
| **Proposal API** | `app/api/proposals/`, `app/api/proposals/[id]/`, `app/api/proposals/[id]/accept/` | Create (admin), GET (public), PATCH (admin + mark_viewed), POST accept → Stripe checkout |
| **Client page** | `app/proposal/[id]/page.tsx` | View proposal, Accept & Pay (single button), redirect to Stripe, post-payment CTA to onboarding |
| **Admin UI** | `ProposalModal.tsx`, `app/admin/sales/[auditId]/page.tsx` | Generate proposal from sales session; returns `proposalLink`; admin shares manually |
| **Stripe** | `lib/stripe.ts`, `app/api/payments/webhook/route.ts` | Checkout session with `proposalId` in metadata; webhook creates order, marks proposal paid, calls `POST /api/client-projects` |
| **Post-payment** | `app/api/client-projects/route.ts`, `lib/onboarding-templates.ts` | Creates client_project, onboarding_plan, PDF; fires `fireOnboardingWebhook` → n8n sends onboarding email. **Planned:** Admin must approve draft before email is sent (human-in-the-loop). |
| **Token-based auth** | `client_dashboard_access`, `lib/client-dashboard.ts` | `access_token` (64-char hex), `validateDashboardToken()`. Used for `/client/dashboard/[token]`. |

### 1.2 Target Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Salesperson     │     │ Admin / Sales UI │     │ Proposal API    │
│ (Admin)         │────▶│ Generate proposal │────▶│ POST /proposals │
└─────────────────┘     │ + Generate code  │     └────────┬────────┘
                        └──────────────────┘              │
                                                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Client          │     │ /proposal/access  │     │ proposals       │
│ (no account)    │────▶│ Enter access code │────▶│ access_code     │
└─────────────────┘     │ → validate       │     │ lookup          │
                        └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │ /proposal/[id]   │     │ View proposal   │
                        │ (session/cookie) │     │ Sign (new)       │
                        └────────┬─────────┘     │ Accept → Pay    │
                                 │               └────────┬────────┘
                                 ▼                        │
                        ┌──────────────────┐              │
                        │ Stripe Checkout  │◀─────────────┘
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │ Webhook          │────▶│ client_projects │
                        │ checkout.session │     │ + onboarding     │
                        │ completed        │     │ plan + PDF       │
                        └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │ Admin           │     │ onboarding_     │
                        │ approves draft  │────▶│ email_sent_at   │
                        │ (human-in-loop) │     │ → fireWebhook   │
                        └──────────────────┘     └─────────────────┘
```

---

## 2. Database Schema Changes

### 2.1 New Columns on `proposals`

```sql
-- Migration: YYYY_MM_DD_proposal_access_code_and_signature.sql

-- Access code: short, shareable, unique (e.g. ABC123XY)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_proposals_access_code
  ON proposals(access_code)
  WHERE access_code IS NOT NULL;

-- Electronic signature (populated when client signs)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS signed_ip TEXT,
  ADD COLUMN IF NOT EXISTS signature_data JSONB;  -- optional: canvas/typed signature payload
```

### 2.2 Status Flow Update

Current: `draft → sent → viewed → accepted → paid → fulfilled`

Proposed: add `signed` between `viewed` and `accepted` (optional) **or** treat signing as part of accept. Recommendation: **Sign and Accept in one step** — client clicks "Sign & Accept" which records signature then proceeds to Stripe. Simpler UX, fewer states.

- `draft` → `sent` (admin marks sent)
- `sent` → `viewed` (client opens)
- `viewed` → `accepted` (client signs + accepts; `signed_at` set)
- `accepted` → `paid` (Stripe webhook)

---

## 3. API Surface

### 3.1 New Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/proposals/access/validate` | None | Body: `{ access_code }`. Returns `{ proposal_id, proposal_link }` or 404. |
| GET | `/api/proposals/by-code/[code]` | None | Redirect to `/proposal/[id]` with session cookie set, or return proposal_id for SPA. |
| POST | `/api/proposals/[id]/sign` | None (or access_code in body) | Body: `{ signed_by_name, signature_data? }`. Records signature, updates status. Returns `{ success }`. |
| PATCH | `/api/admin/proposals/[id]/generate-code` | Admin | Generate and store 6-char `access_code` for proposal. Returns `{ access_code, shareable_link }`. |

### 3.2 Modified Routes

| Route | Change |
|-------|--------|
| `POST /api/proposals` | Optionally generate `access_code` on create (or leave to explicit admin action). |
| `GET /api/proposals/[id]` | N/A — no UUID-only access. Use `/proposal/[code]` only. |
| `POST /api/proposals/[id]/accept` | Require `signed_at` to be set (or sign inline). Merge sign + accept into one flow. |

### 3.3 Access Code Validation Strategy

**Option A — Code in URL (shareable link):**  
`/proposal/access?code=ABC123XY` → validate code → set httpOnly cookie `proposal_access_{proposal_id}` → redirect to `/proposal/[id]`.  
Subsequent requests to `/proposal/[id]` check cookie.

**Chosen:** Option B — `/proposal/[code]` where `code` is the 6-char access code. Resolve code → proposal_id, render proposal page. No UUID-only access; existing test proposals will be removed.

---

## 4. Client-Facing Flow

### 4.1 Pages

| Page | Purpose |
|------|---------|
| `/proposal/access` | Landing: "Enter your access code". Form submits to validate, redirects to `/proposal/[code]`. |
| `/proposal/[code]` | Resolve 6-char `code` to proposal. If invalid → 404 or redirect to `/proposal/access`. Render proposal content (extract from current `/proposal/[id]`). |

### 4.2 Auth Model

- **No Supabase auth** for proposal clients.
- **Access code** = single-factor auth. Client receives code via email/SMS from salesperson.
- **Session:** Optional httpOnly cookie `proposal_session` = `{ proposal_id, code_hash }` with short TTL (e.g. 24h) after successful code validation. Allows refresh without re-entering code.
- **Validation:** On each proposal page load, resolve `code` in URL to proposal via `access_code` lookup. No UUID-based access.

### 4.3 Sign + Accept + Pay Flow

1. Client opens `/proposal/[code]` (6-char access code).
2. Views proposal content (existing UI).
3. Clicks **"Sign & Accept"** (single step):
   - Modal or inline form: "Type your full name to sign" (or simple checkbox "I agree").
   - POST `/api/proposals/[id]/sign` with `signed_by_name`.
   - On success, POST `/api/proposals/[id]/accept` → redirect to Stripe Checkout.
4. After payment, Stripe redirects to `/proposal/[code]?payment=success`.
5. Show "Payment complete" + onboarding CTA (existing behavior).

---

## 5. Integration Points

### 5.1 Stripe

- **Existing:** `createCheckoutSession` in `lib/stripe.ts` uses `proposalId` in metadata. Webhook `checkout.session.completed` reads `proposalId`, creates order, marks proposal paid.
- **Change:** None. Ensure `proposalId` remains in metadata.

### 5.2 n8n — Onboarding Call Trigger

**Current:** `fireOnboardingWebhook` in `lib/onboarding-templates.ts` fires after client project creation. Payload: `onboarding_plan_id`, `client_name`, `client_email`, etc. n8n sends onboarding email.

**New requirement:** "Trigger onboarding call" after sign + pay.

**Options:**

1. **Extend existing webhook:** Add `action: 'onboarding_call'` or `trigger_onboarding_call: true` to payload. n8n workflow branches: if paid, also trigger Calendly invite / calendar link / outbound call workflow.
2. **New webhook:** `N8N_ONBOARDING_CALL_WEBHOOK_URL` — fired from payment webhook after client project creation. Dedicated workflow for scheduling/sending onboarding call invite.

**Recommendation:** Extend existing `fireOnboardingWebhook` payload with `trigger_onboarding_call: true`. n8n workflow can add a node that sends Calendly link or triggers call scheduling. No new env var if n8n can branch. If a separate workflow is preferred, add `fireOnboardingCallWebhook()` and `N8N_ONBOARDING_CALL_WEBHOOK_URL`.

### 5.3 Email

- **Sending proposal:** Salesperson sends link manually today. Optional: add "Email proposal" in admin that triggers n8n to send email with `shareable_link` (e.g. `https://amadutown.com/proposal/ABC123XY`). Would need `N8N_PROPOSAL_EMAIL_WEBHOOK_URL` or similar.
- **Scope:** Phase 1 can keep manual send; Phase 2 add email trigger.

### 5.4 Human-in-the-Loop: Admin Approval Before Onboarding Email

**Current:** `POST /api/client-projects` creates project, plan, PDF, and immediately fires `fireOnboardingWebhook` → n8n sends onboarding email to client.

**New flow:** Admin must approve the draft before the email is sent.

| Step | Behavior |
|------|----------|
| 1. Payment webhook | Creates client_project, onboarding_plan, PDF. **Do NOT** fire webhook. Set `onboarding_email_sent_at = NULL`. |
| 2. Admin queue | Projects with `onboarding_plan_id IS NOT NULL AND onboarding_email_sent_at IS NULL` appear in "Onboarding drafts pending approval". |
| 3. Admin review | Admin views draft: plan link, PDF preview, client info. |
| 4. Admin approve | Admin clicks "Approve & Send" → `POST /api/admin/client-projects/[id]/approve-onboarding` → fires `fireOnboardingWebhook`, sets `onboarding_email_sent_at = now()`. |

**Schema (client_projects):**

```sql
ALTER TABLE client_projects
  ADD COLUMN IF NOT EXISTS onboarding_email_sent_at TIMESTAMPTZ;
-- NULL = draft ready, awaiting admin approval
-- Set = email was sent (webhook fired)

-- Backfill: existing projects with onboarding_plan_id already had email sent
UPDATE client_projects
SET onboarding_email_sent_at = COALESCE(updated_at, created_at)
WHERE onboarding_plan_id IS NOT NULL AND onboarding_email_sent_at IS NULL;
```

**New API:**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/admin/client-projects/[id]/approve-onboarding` | Admin | Fires `fireOnboardingWebhook`, sets `onboarding_email_sent_at`. Idempotent if already sent. |

**Admin UI:** Add "Onboarding drafts" section or filter in Client Projects (`/admin/client-projects`). List projects where `onboarding_plan_id IS NOT NULL AND onboarding_email_sent_at IS NULL`. Each row: client name, product, plan link, PDF link, "Approve & Send" button.

---

## 6. Implementation Phases

### Phase 1: Access Code + Code-Based Access (No Sign Yet)

**Dependencies:** None.

**Tasks:**
1. Migration: add `access_code` to `proposals`.
2. `POST /api/admin/proposals/[id]/generate-code` — generate 6-char alphanumeric code, store, return shareable link.
3. `GET /api/proposals/by-code/[code]/route.ts` — resolve code to proposal_id, return 302 to `/proposal/[id]` or render.
4. Page `/proposal/access` — form to enter code; on submit, validate and redirect to `/proposal/[code]`.
5. Route `/proposal/[code]/page.tsx` — dynamic segment; resolve code → proposal_id, fetch proposal, render same content as `proposal/[id]` (extract shared component).
6. Admin UI: "Generate access code" + "Copy link" in ProposalModal or proposal detail.

**Deliverables:** Salesperson can generate code, share link. Client uses code to view proposal.

---

### Phase 2: Electronic Signature

**Dependencies:** Phase 1.

**Tasks:**
1. Migration: add `signed_at`, `signed_by_name`, `signature_data` to `proposals`.
2. `POST /api/proposals/[id]/sign` — validate proposal state, record signature, set `signed_at`.
3. Update `POST /api/proposals/[id]/accept` — require `signed_at` before creating Stripe session (or sign inline in same request).
4. Client UI: "Sign & Accept" flow — name input, then sign + accept in one or two steps.

**Deliverables:** Client signs before payment. Signature stored on proposal.

---

### Phase 3: Admin Approval Before Onboarding Email (Human-in-the-Loop)

**Dependencies:** None (can run in parallel with Phase 1/2; modifies existing post-payment flow).

**Tasks:**
1. Migration: add `onboarding_email_sent_at TIMESTAMPTZ` to `client_projects`.
2. Modify `POST /api/client-projects`: **remove** the `fireOnboardingWebhook` call. Leave `onboarding_email_sent_at` null. Project, plan, and PDF are still created.
3. Add `POST /api/admin/client-projects/[id]/approve-onboarding` — verify admin, check `onboarding_email_sent_at` is null, fire `fireOnboardingWebhook`, set `onboarding_email_sent_at = now()`. Idempotent if already sent.
4. Admin UI: Add "Onboarding drafts" section or filter in Client Projects. List projects where `onboarding_plan_id IS NOT NULL AND onboarding_email_sent_at IS NULL`. Show plan link, PDF link, "Approve & Send" button.
5. Update `lib/admin-nav.ts` if a dedicated "Onboarding approval" page is added (optional; can live in existing Client Projects with a filter).

**Deliverables:** Admin must approve draft before onboarding email is sent. Projects await approval in admin queue.

---

### Phase 4: Onboarding Call Trigger

**Dependencies:** Phase 3 (email is sent only after admin approval).

**Tasks:**
1. Extend `fireOnboardingWebhook` payload with `trigger_onboarding_call: true` (or add `fireOnboardingCallWebhook`).
2. Create or update n8n workflow to send Calendly link / schedule onboarding call when webhook received.
3. Document `N8N_ONBOARDING_CALL_WEBHOOK_URL` if new webhook.

**Deliverables:** After admin approval, n8n triggers onboarding call scheduling (email + call invite).

---

---

**Note:** Phase 3 (Admin Approval) is independent of the proposal access-code flow. It can be implemented first to add the human-in-the-loop gate before any onboarding email is sent.

**Pre-implementation:** Remove existing test proposals before rollout. No backward compatibility for UUID-only links.

---

## 7. Security Considerations

### 7.1 Access Code Lifecycle

| Aspect | Recommendation |
|--------|----------------|
| **Generation** | Cryptographically random, 6 alphanumeric chars (uppercase for readability). Collision check before insert. |
| **Storage** | Store hashed (e.g. SHA-256) if desired; for short codes, plaintext is acceptable with rate limiting. |
| **Expiry** | Optional: `access_code_expires_at` on proposals. Default: same as `valid_until`. |
| **Revocation** | Admin can regenerate code (invalidate old). Or add `access_code_revoked_at`. |
| **Rate limiting** | Limit validation attempts per IP (e.g. 10/min) to prevent brute force. |

### 7.2 Validation

- Validate `access_code` server-side on every proposal fetch when code is required.
- Do not expose proposal_id in client until code is validated.
- Use `proposal_id` in Stripe metadata (existing); no need to put code in metadata.

### 7.3 Signature

- Store `signed_by_name` and `signed_at` for audit.
- Optional: `signed_ip` for dispute resolution.
- `signature_data` (e.g. canvas image) — optional; consider storage size. Can store in Supabase Storage and reference by URL.

---

## 8. File Reference

| Area | Files |
|------|-------|
| Proposals schema | `database_schema_proposals.sql`, `migrations/` |
| Proposal API | `app/api/proposals/route.ts`, `app/api/proposals/[id]/route.ts`, `app/api/proposals/[id]/accept/route.ts` |
| Proposal page | `app/proposal/[id]/page.tsx` |
| Admin proposal UI | `components/admin/sales/ProposalModal.tsx`, `app/admin/sales/[auditId]/page.tsx` |
| Stripe | `lib/stripe.ts`, `app/api/payments/webhook/route.ts` |
| Client projects | `app/api/client-projects/route.ts` |
| Admin approve onboarding | `app/api/admin/client-projects/[id]/approve-onboarding/route.ts` (new) |
| Onboarding webhook | `lib/onboarding-templates.ts` (`fireOnboardingWebhook`) |
| Token pattern | `lib/client-dashboard.ts`, `migrations/2026_02_16_client_dashboard_tables.sql` |

---

## 9. Discovery Prompts for Cursor

When implementing, use these prompts to gather context:

**Phase 1 — Access code:**
> Search for: proposal creation flow, where proposalLink is returned, admin proposal actions. Add access_code column, generate-code endpoint, by-code route, proposal/access page.

**Phase 2 — Signature:**
> Search for: proposal accept flow, where status becomes accepted. Add sign endpoint, signed_at columns, Sign & Accept button flow.

**Phase 3 — Admin approval (human-in-the-loop):**
> Search for: POST /api/client-projects, fireOnboardingWebhook call site. Add onboarding_email_sent_at column, remove auto-fire of webhook, add approve-onboarding endpoint and admin UI queue.

**Phase 4 — Onboarding call:**
> Search for: fireOnboardingWebhook, N8N_ONBOARDING_WEBHOOK_URL. Extend payload or add onboarding call webhook.

---

## 10. Decisions (Resolved)

| Question | Decision |
|----------|----------|
| Sign flow | Single "Sign & Accept" — records signature then redirects to Stripe |
| Access code length | 6 characters |
| Backward compatibility | None needed. Existing proposals are test data; remove them. No UUID-only fallback. |
| Email sending (Phase 1) | Manual send. No n8n email trigger in Phase 1. |
