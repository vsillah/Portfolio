---
name: E2E and Scripts UI Alignment
overview: Align the E2E testing suite with the prospect → lead → client journey, then add a "Client Journey Scripts" section to Admin → Testing so you can run seed/trigger scripts from the UI and see how they map to E2E scenarios and downstream impact.
todos: []
isProject: false
---

# E2E Suite and Test Scripts UI Alignment

## Current state

- **E2E scenarios** ([lib/testing/scenarios.ts](lib/testing/scenarios.ts)): 9 scenarios (browse and buy, chat to diagnostic, service inquiry, full funnel, abandoned cart, support escalation, quick browse, warm lead pipeline, standalone audit tool). They are tagged but not explicitly grouped by **prospect / lead / client** stages.
- **Admin Testing UI** ([app/admin/testing/page.tsx](app/admin/testing/page.tsx)): Scenario/persona selection, Start Test Run, Stripe Test Checkout (WF-001), Recent Test Runs, Errors, Remediation. **No integration of the scripts** in `scripts/` (trigger-*.sh and seed-*.sql).
- **Test scripts** (from transcript 3522e7a1): Used to validate n8n workflows (WF-CAL, WF-001B, WF-000A, WF-002, etc.). Pattern: **seed SQL in Supabase** then **run trigger shell script** (curl to webhook). Documented in [docs/n8n-cloud-workflow-setup.md](docs/n8n-cloud-workflow-setup.md).
- **Client journey** (from [docs/admin-sales-lead-pipeline-sop.md](docs/admin-sales-lead-pipeline-sop.md)): **Prospect** (visit, contact form, chat, diagnostic) → **Lead** (contact_submissions, enrichment, outreach, conversation, proposal) → **Client** (payment → client_projects → onboarding → kickoff → milestones).

---

## UX design (Lead UX Designer)

These decisions keep the UI intuitive, consistent with admin layouts, and aligned with the client journey.

**Information architecture**
- Keep **Client Journey Scripts on the same page** as Start New Test Run (no tabs or sub-pages). Add as a **collapsible section**.
- **Page section order:** (1) Start New Test Run, (2) Client Journey Scripts, (3) Stripe Test Checkout (WF-001), (4) Recent Test Runs, then Live Activity / Errors / Remediation.
- **E2E scenario config:** Group scenario chips by **Prospect | Lead | Client** (subheadings or visual grouping). Add a **"Client Journey" preset** that selects scenarios in journey order. Label preset: *"Runs scenarios across Prospect → Lead → Client in order."*
- No new sidebar item; E2E Testing stays the single entry under Quality & insights in [lib/admin-nav.ts](lib/admin-nav.ts).

**Visual hierarchy and consistency**
- Reuse existing Testing page patterns: same card (`bg-gray-800 rounded-xl p-6 mb-8`), collapsible header with `ChevronDown`/`ChevronUp`.
- Use **rose → red** gradient or accent for the Client Journey Scripts section header (Testing/QA palette per admin-features rule).
- Script rows: one row per script with name, **stage badge** (Prospect / Lead / Client — visible text, not only color), **Copy SQL** and **Run trigger**. Same button styles as elsewhere (e.g. `bg-green-600` for Run, `bg-gray-600` for Copy).
- Within each stage, list scripts in **recommended order** with "Step 1 / 2" or one line: *"Run seed first, then trigger."*
- **Downstream impact:** one short line per script or tooltip (info icon with `title`/`aria-describedby`). **Related E2E scenario:** show as a chip or link (e.g. "Run scenario: Warm Lead Pipeline").

**Client journey alignment**
- Add a **compact horizontal stepper** at the top of the Client Journey Scripts section: **Prospect → Lead → Client** (three segments, no wizard state). Group script rows under stage subheadings (Prospect, Lead, Client) so the list mirrors the stepper.

**Actions and feedback**
- **Copy SQL:** Primary "Copy SQL" button; reuse existing toast (`showToast('success', 'Copied to clipboard!')`). Optional "Open in Supabase" link with `ExternalLink` icon, new tab.
- **Run trigger:** Loading state (disable button + spinner, "Triggering..."); success toast (e.g. "Trigger sent"); failure toast (generic message, no raw errors). Optional "View in n8n" link if API returns execution URL. Optional "Last run: X min ago" per script for later.
- Accessible names: e.g. "Copy seed SQL for [script name]", "Run trigger for [script name]".

**Microcopy**
- **Panel description (under "Client Journey Scripts"):** *"Prepare test data by stage: run each script in order (seed first, then trigger), then start a test run with the Client Journey preset above."*
- **Run order note:** *"Order: 1) Copy/run seed SQL (in Supabase or paste here). 2) Run trigger to fire the webhook. 3) Start test run with the linked scenario."*

**Accessibility**
- Section: `aria-label` or heading + one-line description. Collapsible: button with `aria-expanded` and `aria-controls`. Stage badges with visible text. Buttons and links focusable and activatable with Enter/Space.

---

## Part 1: Align E2E suite with prospect → lead → client journey

### 1.1 Map existing scenarios to journey stages

| Stage        | Scenarios that belong                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Prospect** | quick_browse, standalone_audit_tool, service_inquiry (contact form), chat_to_diagnostic (engagement before lead) |
| **Lead**     | full_funnel (through contact), warm_lead_pipeline, service_inquiry (post-submit → lead webhook)                  |
| **Client**   | browse_and_buy (checkout → order), full_funnel (if extended to proposal/checkout)                               |

Add a **journey stage** (or tags) to each scenario so the UI and presets can filter by stage.

**Concrete steps:**
- In [lib/testing/scenarios.ts](lib/testing/scenarios.ts), add a `journeyStage` (or extend `tags`) for each scenario: `'prospect' | 'lead' | 'client'`. For example:
  - `quick_browse`, `standalone_audit_tool` → prospect
  - `service_inquiry`, `chat_to_diagnostic`, `full_funnel`, `warm_lead_pipeline` → lead (and prospect where applicable)
  - `browse_and_buy` → client (post-purchase validation); optionally keep full_funnel as lead + partial client
- Export a **journey-ordered list** (e.g. `SCENARIOS_BY_JOURNEY`) or **preset** `journey` that returns scenarios in order: prospect first, then lead, then client, so a single "Run full journey" uses the right order.

### 1.2 "Client journey" preset in API and UI

- In [app/api/testing/run/route.ts](app/api/testing/run/route.ts), support `scenarioPreset: 'journey'` that uses the new journey-ordered scenario list (or a curated subset that covers prospect → lead → client without duplication).
- In [app/admin/testing/page.tsx](app/admin/testing/page.tsx), add a preset button or dropdown (e.g. "Smoke", "Critical", "Client Journey") so users can start a run that matches the client journey. Use preset label **"Client Journey"** with helper text: *"Runs scenarios across Prospect → Lead → Client in order."*

### 1.3 Documentation

- Update the E2E simulator plan if it exists, or add a short section in [docs/regression-smoke-checklist.md](docs/regression-smoke-checklist.md) or a new `docs/e2e-client-journey.md`: map journey stages to scenarios and to the script-based validations (below).

---

## Part 2: Integrate test scripts into Admin Testing UI

Goal: one place to run (or copy) seed + trigger scripts and see **downstream impact** and **which E2E scenario** validates the outcome.

### 2.1 Script inventory and metadata

Create a **single source of truth** for script metadata (stage, prereqs, downstream impact, related E2E scenario). Recommended: new file `lib/testing/journey-scripts.ts` (or `lib/testing/script-catalog.ts`) that exports an array of script actions with:
- id, label, stage (`prospect` | `lead` | `client`)
- type: `seed_sql` | `trigger_webhook`
- scriptPath (e.g. `scripts/seed-discovery-call-test-contact.sql`), or webhookId for trigger
- prereq: string (e.g. "Run seed X first")
- downstreamImpact: string (e.g. "Creates/updates contact_submissions; WF-000A sends to n8n")
- relatedScenarioId: string (e.g. `standalone_audit_tool` or null)
- triggerScriptPath for trigger type (e.g. `scripts/trigger-discovery-call-booked-webhook.sh`)

Populate for: Prospect/Lead (discovery), Lead/Client (onboarding), Client (kickoff), Lead (lead qualification), Client payment (Stripe already in UI → WF-001), plus other trigger scripts from [scripts/](scripts/) as desired.

### 2.2 UI: "Client Journey Scripts" panel

Add a new collapsible section on [app/admin/testing/page.tsx](app/admin/testing/page.tsx) **between "Start New Test Run" and "Stripe Test Checkout (WF-001)"** (see UX design above for full page order).

- **Title:** "Client Journey Scripts". Use rose → red accent on the section header (icon or left border).
- **Stepper:** At the top of the section, a compact horizontal **Prospect → Lead → Client** stepper (no step validation).
- **Grouping:** Group script rows under stage subheadings (Prospect, Lead, Client); within each stage, list in recommended order (seed then trigger) with "Step 1 / 2" or inline note.
- **Per script row:**
  - Label, **stage badge** (Prospect / Lead / Client, visible text).
  - **Prereq:** e.g. "Run seed SQL in Supabase first."
  - **Downstream impact:** One short line or tooltip (info icon + aria).
  - **Related E2E scenario:** Chip or link (e.g. "Run scenario: Standalone Audit Tool").
  - **Actions:** "Copy SQL" (toast on copy), optional "Open in Supabase"; "Run trigger" (loading + success/error toasts, optional "View in n8n" on success). Use accessible names: "Copy seed SQL for [name]", "Run trigger for [name]".
- **Microcopy:** Panel description and run-order note as in UX design section.

No need to run shell scripts from the server; triggers can be implemented as API calls that mirror the curl in the .sh scripts.

### 2.3 API for triggering webhooks (no shell execution)

- Add internal API route(s), e.g. `POST /api/admin/testing/trigger-webhook` with body `{ scriptId: 'discovery_call_booked' }`, or one route per workflow.
- Handler loads webhook URL from env (same as the .sh script), loads the same mock payload (e.g. from `scripts/*-mock-payload.json` or inlined), and `fetch(POST)` to the webhook. Use server-side env so keys are not exposed.
- Require **admin auth** (same as other admin testing APIs).
- Return success/failure and optionally n8n execution id if the response contains it.

### 2.4 Downstream impact and E2E linkage

- In the script catalog, for each entry set `downstreamImpact` and `relatedScenarioId`.
- In the UI, show "After running, you can validate with E2E scenario: **Standalone Audit Tool**" (or equivalent) and optionally a "Start E2E run" that pre-selects that scenario.

---

## Part 3: Verification and docs

- **Regression checklist:** In [docs/regression-smoke-checklist.md](docs/regression-smoke-checklist.md), add a subsection: "Client journey E2E: run scenarios by stage (prospect / lead / client) or use preset 'journey'; for workflow validation, use Admin → Testing → Client Journey Scripts (seed in Supabase, then Run trigger)."
- **E2E simulator plan:** Update to reference journey stages and the new script panel; if no plan exists, use `docs/e2e-client-journey.md` as the reference.

---

## Implementation order (suggested)

1. **Journey mapping:** Add `journeyStage` (or tags) and journey-ordered export in `lib/testing/scenarios.ts`.
2. **Script catalog:** Add `lib/testing/journey-scripts.ts` (or equivalent) with metadata for seed + trigger scripts you want in the UI.
3. **Trigger API:** Add `POST /api/admin/testing/trigger-webhook` (or per-workflow routes) that POST to n8n with mock payloads, admin-protected.
4. **UI panel:** Add "Client Journey Scripts" section to Admin Testing page: stepper, groups by stage, Copy SQL, Run trigger, downstream impact, related scenario; follow UX design (section order, rose-red accent, microcopy, a11y).
5. **Preset and docs:** Add `journey` preset to run API and UI (label "Client Journey", helper text as in UX); update regression checklist and E2E plan/docs.

---

## Implementation checklist (UX handoff)

| Area | Action |
|------|--------|
| **IA** | Add "Client Journey Scripts" as a collapsible section on `app/admin/testing/page.tsx` (between Start New Test Run and Stripe panel). Do not add a new nav item. |
| **Scenarios** | Add `journeyStage` (or tags) to scenarios; in the same page, group scenario chips by Prospect / Lead / Client and add a "Client Journey" preset that selects the journey scenarios. |
| **Visual** | Use `bg-gray-800 rounded-xl p-6`, rose→red accent for Scripts header, same button and toast patterns as existing sections. |
| **Scripts list** | One row per script: name, stage badge, Copy SQL, optional Open in Supabase, Run trigger; optional one-line downstream impact; related scenario as chip or link. Show recommended order (e.g. Step 1/2 or short sentence). |
| **Journey** | Add compact Prospect → Lead → Client stepper at top of Scripts section; group script rows under stage subheadings or accordions. |
| **Actions** | Run trigger: loading state + success/error toasts; optional "View in n8n" on success; optional last-run text. Copy reuses existing toast. |
| **A11y** | Section description, aria-labels on actions, stage badges with text, tooltip/aria for impact text, keyboard-accessible collapsible. |
| **Copy** | Add the three microcopy strings from UX design (panel description, run order, preset description). |

---

## Out of scope (for later)

- Actually executing seed SQL from the app (possible but requires careful scoping and safety; "Copy SQL" is enough for v1).
- Running the .sh scripts on the server (security and environment; trigger via API is the preferred integration).
