# Regression & Smoke Checklist

Use this for releases, after large changes, or when hardening a flow. Run manual steps and/or the automated tests referenced below.

**See also:** [Integration testing — environment matrix](./integration-testing-environment-matrix.md) (which scenarios hit n8n / Stripe / LLM and which deploy tier to use). [Staging environment](./staging-environment.md) (Vercel staging + automatic n8n defaults when `NEXT_PUBLIC_APP_ENV=staging`).

## 1. Critical paths (manual or E2E)

- **Leads list**
  - Admin → Outreach → **Leads** tab.
  - Temperature filter = **All leads** → Refresh → at least one lead appears (or empty state if none).
  - Visibility = **Active only** (default), **Do not contact**, **Removed**, or **All** → list updates.
  - Search by name → expected rows (e.g. "Rasheed Meadows").
  - Per-lead **Do not contact** / **Remove** / **Restore** (when viewing Removed) work and refresh the list.
- **Outreach queue**
  - **Queue** tab loads; filter by status (e.g. Draft / Approved) → list updates.
- **Value evidence**
  - **Unified Lead modal**: open via **Edit**, **Push to Value Evidence** (bulk or single), or **Retry** → same modal with Lead details + Value Evidence sections, Save changes and Push to Value Evidence buttons.
  - Push completes or fails with a clear state (no stuck "Extracting..." without Cancel).
- **Meeting → tasks → outreach cascade**
  - Admin → Meetings → row **View tasks** opens `/admin/meeting-tasks?meeting_record_id=<id>` with a visible scope chip; **View transcript** opens the meeting detail and its Tasks section.
  - On a promoted task with `task_category='outreach'` and an attributed contact, **Send to outreach** returns 200 and creates an `outreach_queue` row with `source_task_id = task.id`; the task shows **Draft ready**.
  - Clicking **Send to outreach** again on the same task is **idempotent** — returns the existing draft (same `outreach_queue.id`), no duplicate row.
  - On Admin → Outreach → Leads, expanding a lead that has attributed meeting action items shows the **Meeting action items attributed to this lead** panel with correct open/total counts and **Manage →** link.
  - `PATCH /api/meetings/[id]/assign-lead` with a new `contact_submission_id` backfills matching `meeting_action_tasks.contact_submission_id`; retargeted (manually edited) tasks are preserved.

## 2. Filter "all" contract

When a list API has a filter with an **"all"** option (e.g. temperature = all, status = all, source = all):

- The backend must **not** apply that dimension when "all" is selected (or when the param is omitted).
- Example: `filter=all` for leads must not restrict by `lead_source`; otherwise leads with `website_form` or `other` disappear.

See also: `.cursor/rules/filter-all-option.mdc`.

## 3. Where key enums / values live (grep before changing)

Keep these in sync when adding/removing/renaming values:

| Concept        | DB constraint / schema     | API validation / use                    | Frontend / UI              |
|----------------|----------------------------|-----------------------------------------|----------------------------|
| `lead_source`  | `contact_submissions_lead_source_check` (migrations) | `lib/constants/lead-source.ts`, GET/POST `api/admin/outreach/leads`, `api/admin/outreach/ingest` | Outreach Leads filters, Add Lead form |
| `outreach_status` | (table column)         | GET `api/admin/outreach/leads` (status param) | Leads tab status filter   |
| `service_type` | Services table constraint  | Route validation (grep `service_type`)  | Services UI                |
| `task_category` | `meeting_action_tasks.task_category CHECK ('internal','outreach')` (migrations/2026_04_17_meeting_action_tasks_contact_attribution.sql) | `lib/meeting-action-tasks.ts` (`inferTaskCategory`, `listTasks`, `updateTask`), GET/PATCH `api/meeting-action-tasks`, POST `api/meeting-action-tasks/[id]/send-to-outreach` | Admin → Meeting Tasks (filter, badge, edit modal); Admin → Outreach → Leads (attributed tasks panel) |
| `outreach_queue.source_task_id` | `outreach_queue.source_task_id UUID` + FK to `meeting_action_tasks(id)` (same migration) | `lib/outreach-queue-generator.ts` (draft-exists guard scoped by `source_task_id`), `send-to-outreach` route (idempotency), `lib/meeting-tasks-context.ts` | — (internal backref; no UI filter) |
| `{{meeting_action_items}}` placeholder | `system_prompts.prompt` for `email_cold_outreach` and `email_follow_up` (migrations/2026_04_17_*) | `lib/outreach-queue-generator.ts` (step 1), `lib/delivery-email.ts` (LINK_FREE_TEMPLATES only), `lib/meeting-tasks-context.ts` (`applyMeetingActionItemsPlaceholders`) | — (prompt-side only) |
| Per-asset `tech_stack` | `content_offer_roles.tech_stack` JSONB (migrations/2026_04_17_feasibility_v1.sql) | `lib/feasibility-snapshot.ts` (`loadBundleProposedItems`), `lib/gamma-report-builder.ts` | — (admin-side; edited per-asset in future) |
| Our canonical stack | — (code constant) | `lib/constants/our-tech-stack.ts` (`OUR_TECH_STACK`, `OUR_TECH_STACK_VERSION`) | Reflected in Implementation Fit slides + proposal projection |
| BuiltWith tag map | — (code constant) | `lib/constants/builtwith-tag-map.ts` (`normalizeBuiltWithTag`) | — (engine only) |
| `client_verified_tech_stack` | `contact_submissions.client_verified_tech_stack` JSONB | `PATCH /api/admin/contact-submissions/[id]/verified-tech-stack`; `lib/feasibility-snapshot.ts` (precedence > audit > BuiltWith) | Admin → Sales → [auditId] → Client tech stack (admin-verified) |
| `feasibility_assessment` snapshot | `gamma_reports.feasibility_assessment`, `proposals.feasibility_assessment` | Written by `lib/gamma-generation.ts`, `app/api/proposals/route.ts`; projected by `lib/implementation-feasibility.ts#projectForClient` | Client-facing Implementation Fit block on `/proposal/[code]` |

Before changing any of these, grep the codebase for the constant name and update every layer in the same change (see `.cursor/rules/enum-sync-checklist.mdc`).

## 4. Automated coverage

- **Unit (Vitest):** `lib/constants/lead-source.test.ts` — lead_source helpers, mapping, `getRelationshipStrength`, and ingest allowlist. `lib/implementation-feasibility.test.ts` — feasibility engine (stack merge, effort scoring, client projection).
- **Admin → Testing smoke:** Run the **"Feasibility Snapshot (Schema Smoke)"** scenario after applying `migrations/2026_04_17_feasibility_v1.sql` to verify the new columns are present on `gamma_reports`, `proposals`, and `contact_submissions`.
- **E2E (Playwright):** `e2e/admin-outreach.spec.ts`:
  - **API:** GET `/api/admin/outreach/leads?filter=all` and GET `/api/admin/outreach?status=all` (200 or 401, correct body shape).
  - **UI:** Outreach page loads (Queue or Leads or sign-in); Leads tab shows filter/empty state or sign-in; Queue tab shows queue content or sign-in.

**Shared constants:** `lib/constants/lead-source.ts` is used by `api/admin/outreach/leads` (POST), `api/admin/outreach/ingest` (validation + `getRelationshipStrength`), and the outreach admin UI (temperature icon). Add or change values there and in the DB only (see Section 3).

Run: `npm test` (Vitest), `npx playwright test e2e/admin-outreach.spec.ts` (E2E).

## 5. Client journey E2E

Scenarios are mapped to three journey stages: **Prospect → Lead → Client**. Use the **"Client Journey" preset** in Admin → Testing to run them in order, or select individual stages.

- **Prospect:** Quick Browse, Standalone Audit Tool, Abandoned Cart, Chat to Diagnostic, Service Inquiry.
- **Lead:** Chat to Diagnostic, Service Inquiry, Warm Lead Pipeline, Support Escalation, Full Funnel.
- **Client:** Full Funnel, Browse and Buy.

**Workflow validation (n8n):** Use Admin → Testing → **Client Journey Scripts** to seed test data and trigger n8n webhooks by stage:
1. Copy/run the seed SQL in Supabase SQL Editor.
2. Click "Run trigger" to fire the webhook.
3. Start a test run with the linked E2E scenario to validate the outcome.

Script catalog: `lib/testing/journey-scripts.ts`. Trigger API: `POST /api/admin/testing/trigger-webhook`. Seed SQL API: `GET /api/admin/testing/seed-sql`.

**Seeding demo leads:** See `docs/seed-demo-leads.md`. Prefer **Admin → Testing → Populate Demo Data** (E2E) over SQL.
