# Database Schema Setup Order

⚠️ **IMPORTANT**: Run these schema files in the correct order to avoid errors!

## Order of Execution

### 1. **Base Contact Table** (RUN FIRST)
```
database_schema_base_contacts.sql
```
Creates the core `contact_submissions` table that all other schemas depend on.

### 2. **User Profiles** (RUN SECOND)
```
database_schema_user_profiles.sql
```
Creates the `user_profiles` table for admin authentication and role-based access control.

### 3. **Contact Updates** (RUN THIRD)
```
database_schema_contact_update.sql
```
Adds lead qualification fields (company, lead_score, etc.)

### 4. **Cold Lead Pipeline** (RUN FOURTH)
```
database_schema_cold_lead_pipeline.sql
```
Adds warm/cold lead tracking, outreach queue, and the `warm_lead_trigger_audit` table.

### 5. **Client Projects** (RUN FIFTH)
```
database_schema_client_projects.sql
```
Creates `client_projects` and `project_reminders` tables for WF-006 Milestone Planning.

### 6. **Meeting Records** (RUN SIXTH)
```
database_schema_meeting_records.sql
```
Creates `meeting_records` table for WF-MCH (Meeting Complete Handler). Depends on `client_projects`.

### 7. **Other Schemas** (Order doesn't matter)
- `database_schema_system_prompts.sql` - System prompts for chatbot, voice agent, evaluation (required for Admin → System Prompts)
- `database_schema_chat.sql` - Chat sessions and messages
- `database_schema_diagnostic.sql` - AI diagnostic audits
- `database_schema_testing.sql` - E2E testing framework
- `database_schema_proposals.sql` - Proposal tracking
- `database_schema_sales.sql` - Sales funnel
- `database_schema_bundles.sql` - Offer bundles (extends sales)
- `database_schema_services.sql` - Service catalog
- etc.

### 8. **Migrations** (if not using full schema files)
- `migrations/2026_02_10_offer_bundles.sql` - Creates `offer_bundles` only (use if Sales/Bundles UI fails with "table offer_bundles not found").

## Quick Setup Command

If you have direct PostgreSQL access:

```bash
# Run in order
psql -h your-db-host -U postgres -d postgres -f database_schema_base_contacts.sql
psql -h your-db-host -U postgres -d postgres -f database_schema_user_profiles.sql
psql -h your-db-host -U postgres -d postgres -f database_schema_contact_update.sql
psql -h your-db-host -U postgres -d postgres -f database_schema_cold_lead_pipeline.sql
```

## Via Supabase SQL Editor

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `database_schema_base_contacts.sql`
3. Click **Run**
4. Repeat for `database_schema_user_profiles.sql`
5. Repeat for `database_schema_contact_update.sql`
6. Repeat for `database_schema_cold_lead_pipeline.sql`

## Verification

After running all three, verify with:

```sql
-- Check base table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'contact_submissions';

-- Check columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'contact_submissions'
ORDER BY ordinal_position;

-- Check warm lead audit table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'warm_lead_trigger_audit';
```

All three queries should return results.

## Troubleshooting

### Error: "relation contact_submissions does not exist"
→ You skipped step 1. Run `database_schema_base_contacts.sql` first.

### Error: "column lead_source already exists"
→ You already ran the schema. Safe to ignore or drop and recreate.

### Error: "cannot change name of view column"
→ Drop conflicting views first:
```sql
DROP VIEW IF EXISTS qualified_leads CASCADE;
DROP VIEW IF EXISTS lead_temperature_distribution CASCADE;
```
