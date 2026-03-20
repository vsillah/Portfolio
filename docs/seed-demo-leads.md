# Seeding Demo Leads for Development

## Was blank lead/contact data intentional?

**Yes.** The dev database is designed to start with a clean slate for privacy and to avoid mixing real production data with test data. The `npx tsx scripts/seed-dev.ts` script only seeds **products, lead magnets, pricing, and value calculations** — it does **not** seed leads or contacts.

Lead/contact seed data can be created via the **E2E test module** (preferred) or SQL files.

---

## How to seed leads at various stages

### Option 1: E2E Test Module — Populate Demo Data (recommended)

Use the Admin Testing page to create demo leads via API — no SQL required.

1. Go to **Admin → Testing**.
2. In **Quick Presets**, click **Populate Demo Data** (purple button).
3. The run creates:
   - **2 warm leads** (demo-warm1@example.com, demo-warm2@example.com) via ingest API
   - **1 cold lead** (demo-cold@example.com) via ingest API
   - **1 discovery contact** (demo-discovery@example.com) via Add Lead API
   - **1 service inquiry** via contact form (persona-based)
   - **Sarah Mitchell** full lead + diagnostic (`sarah.mitchell@techflow.io`, session `test-lead-session-001`)
   - **Paid proposal** for Jordan Rivera (`jordan@acmecorp.com`)
   - **Lead qualification** contact `id=99999` (`test-lead-qual-99999@example.com`)
   - **Onboarding** test project (`test-onboarding@example.com`)
   - **Kickoff** test project (`test-kickoff@example.com`)
   - **Discovery** SQL-compat contact (`test-discovery@example.com`)

You can also seed individually via **admin API** (while logged in as admin):

`POST /api/admin/testing/demo-seed` with JSON body `{ "key": "<key>" }` where `key` is one of:
`sarah_mitchell_lead`, `paid_proposal_jordan`, `lead_qualification_99999`, `onboarding_test_project`, `kickoff_test_project`, `discovery_call_test_contact`.

**Requirements:**
- Logged in as admin
- `N8N_INGEST_SECRET` in `.env.local` (for ingest API calls)

Data is **not** cleaned up after the run, so it persists for demos.

---

### Option 2: Client Journey Scripts (SQL + trigger)

For journeys not yet covered by E2E scenarios:

1. Go to **Admin → Testing**.
2. Open the **Client Journey Scripts** section.
3. For each stage, use **Copy** to get the seed SQL, then run it in **Supabase Dashboard → SQL Editor**.

| Stage | Script | What it creates |
|-------|--------|-----------------|
| **Lead** | Seed: Lead Qualification Test Row | `contact_submissions` row (id 99999) — B2B lead for qualification webhook |
| **Lead** | Seed: Discovery Call Contact | `contact_submissions` row for `test-discovery@example.com` |
| **Client** | Seed: Onboarding Client Project | `client_projects` row (requires Stripe checkout first) |
| **Client** | Seed: Kickoff Client Project | `client_projects` row for kickoff flow |

After running a seed, you can click **Run trigger** to fire the linked n8n webhook (if configured).

---

### Option 3: Run SQL files directly in Supabase SQL Editor

Run these in **Supabase Dashboard → SQL Editor** in the order you need:

| File | Stage | What it creates |
|------|-------|-----------------|
| `database_seed_test_lead.sql` | Lead | **Sarah Mitchell** (TechFlow Solutions) — full contact + completed diagnostic audit |
| `database_seed_test_proposal.sql` | Client | **Jordan Rivera** — paid proposal for AI Chatbot Solution |
| `scripts/seed-lead-qualification-test-row.sql` | Lead | Test lead (id 99999) for qualification webhook |
| `scripts/seed-discovery-call-test-contact.sql` | Lead | `test-discovery@example.com` for discovery call flow |
| `migrations/seed_test_cold_lead.sql` | Lead | **Test McTesterson** — cold lead for enrichment/outreach pipeline |

---

## Quick demo setup: one lead at each stage

**Preferred:** Use **Populate Demo Data** in Admin → Testing to create warm leads, cold lead, discovery contact, and service inquiry in one click.

**Alternative:** Run SQL files:

```sql
-- 1. Warm lead with full diagnostic (Sarah Mitchell)
-- Run: database_seed_test_lead.sql

-- 2. Paid proposal for project creation flow (Jordan Rivera)
-- Run: database_seed_test_proposal.sql

-- 3. Cold lead for outreach pipeline (Test McTesterson)
-- Run: migrations/seed_test_cold_lead.sql
```

Then run `scripts/seed-lead-qualification-test-row.sql` and `scripts/seed-discovery-call-test-contact.sql` if you need those specific test contacts.

---

## Cleanup

After demos, use **Admin → Testing → Clean Up Test Data** to remove seed rows from `contact_submissions` and `client_projects`, or run the cleanup API:

```
POST /api/admin/testing/cleanup-seeds
```

---

## Including lead seeds in dev bootstrap

If you use `npx tsx scripts/apply-migrations-to-dev.ts` to generate `dev-combined-migrations.sql`, the following are already included in Phase 3 (seed data):

- `database_seed_content.sql`
- `database_seed_kickoff_agenda_templates.sql`
- `database_seed_onboarding_templates.sql`
- `database_seed_progress_update_templates.sql`
- `database_schema_sales_seed.sql`
- `database_seed_test_lead.sql`
- `database_seed_test_proposal.sql`

So if you **paste and run** the full `dev-combined-migrations.sql` in Supabase SQL Editor when bootstrapping dev, you will get Sarah Mitchell and Jordan Rivera automatically. If you bootstrap via `supabase db push` or migrations only, those seed files are not applied — use **Populate Demo Data** or the SQL options above.
