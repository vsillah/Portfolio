# Regression & Smoke Checklist

Use this for releases, after large changes, or when hardening a flow. Run manual steps and/or the automated tests referenced below.

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

Before changing any of these, grep the codebase for the constant name and update every layer in the same change (see `.cursor/rules/enum-sync-checklist.mdc`).

## 4. Automated coverage

- **Unit (Vitest):** `lib/constants/lead-source.test.ts` — lead_source helpers, mapping, `getRelationshipStrength`, and ingest allowlist.
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
