# Warm Lead Workflow Integration

## Overview

This document describes the complete warm lead workflow integration, including manual triggers from the admin dashboard and comprehensive E2E testing support.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Warm Lead Pipeline                            │
└─────────────────────────────────────────────────────────────────────┘

1. TRIGGER (Manual or Scheduled)
   ├─ Admin Dashboard UI (expandable section)
   │  └─ POST /api/admin/outreach/trigger
   └─ n8n Scheduled Workflows (daily)

2. SCRAPING (n8n Workflows)
   ├─ WF-WRM-001: Facebook (Friends, Groups, Engagement)
   ├─ WF-WRM-002: Google Contacts
   └─ WF-WRM-003: LinkedIn (Connections, Engagement)

3. INGESTION
   └─ POST /api/admin/outreach/ingest
      ├─ Validates N8N_INGEST_SECRET
      ├─ Deduplicates by email/linkedin
      └─ Inserts to contact_submissions table

4. ENRICHMENT (Automatic)
   └─ Background workflow enriches lead data
      ├─ Company lookup
      ├─ Social profiles
      └─ Contact validation

5. OUTREACH GENERATION (AI)
   └─ Background workflow generates personalized messages
      └─ Inserts to outreach_queue (status: draft)

6. HUMAN REVIEW
   └─ /admin/outreach page
      ├─ Review AI-generated messages
      ├─ Approve/Reject/Edit
      └─ Batch operations

7. SENDING
   └─ Manual or automated send
      ├─ Updates outreach_queue (status: sent)
      └─ Updates contact_submissions (outreach_status: contacted)
```

## Components

### 1. Trigger API Endpoint

**File:** `app/api/admin/outreach/trigger/route.ts`

**Endpoints:**
- `POST /api/admin/outreach/trigger` - Trigger warm lead scraping
- `GET /api/admin/outreach/trigger` - Get trigger history

**Request Body:**
```json
{
  "source": "facebook" | "google_contacts" | "linkedin" | "all",
  "options": {
    "max_leads": 100,
    "group_uids": ["group1", "group2"],
    "profile_url": "https://...",
    "scrape_type": "connections" | "engagement" | "both"
  }
}
```

**Features:**
- Admin authentication required
- Triggers n8n workflows via webhooks
- Creates audit log entries
- Supports single source or all sources
- Returns execution IDs for tracking

### 2. Admin Dashboard UI

**File:** `app/admin/outreach/dashboard/page.tsx`

**Features:**
- Expandable "Trigger Warm Lead Scraping" section
- Individual source triggers (Facebook, Google, LinkedIn)
- "Trigger All Sources" button
- Configurable max leads per source
- Last run timestamps
- Success/error feedback
- Real-time trigger history

**UI Flow:**
1. Click to expand trigger section
2. Configure max leads for each source
3. Click trigger button for source
4. View success/error message
5. Dashboard auto-refreshes with new leads

### 3. Database Schema

**File:** `database_schema_cold_lead_pipeline.sql`

**New Table:** `warm_lead_trigger_audit`

```sql
CREATE TABLE warm_lead_trigger_audit (
  id UUID PRIMARY KEY,
  source TEXT,                    -- facebook, google_contacts, linkedin, all
  triggered_by UUID,              -- User who triggered
  triggered_at TIMESTAMPTZ,       -- When triggered
  options JSONB,                  -- Trigger options
  n8n_execution_id TEXT,          -- n8n execution ID
  status TEXT,                    -- pending, running, success, failed
  leads_found INTEGER,            -- Total leads found
  leads_inserted INTEGER,         -- Total leads inserted
  error_message TEXT,             -- Error if failed
  completed_at TIMESTAMPTZ        -- When completed
);
```

**Indexes:**
- `idx_warm_trigger_audit_source` - Query by source
- `idx_warm_trigger_audit_user` - Query by user
- `idx_warm_trigger_audit_status` - Query running/pending

### 4. E2E Testing Framework

#### New Test Step Types

**File:** `lib/testing/types.ts`

1. **`apiCall`** - Make HTTP API calls
   ```typescript
   {
     type: 'apiCall',
     endpoint: '/api/admin/outreach/trigger',
     method: 'POST',
     body: { source: 'facebook' },
     expectedStatus: 200,
     expectedResponse: { success: true }
   }
   ```

2. **`adminAction`** - Perform admin actions
   ```typescript
   {
     type: 'adminAction',
     action: 'approve_outreach' | 'reject_outreach' | 'send_outreach' | 'trigger_scraping',
     target: 'first_draft',
     options: { ... }
   }
   ```

3. **`waitForData`** - Poll database for data
   ```typescript
   {
     type: 'waitForData',
     table: 'contact_submissions',
     conditions: { lead_source: 'warm_facebook_friends' },
     timeout: 30000,
     expectedCount: 1
   }
   ```

#### Warm Lead Pipeline Scenario

**File:** `lib/testing/scenarios.ts`

**Scenario ID:** `warm_lead_pipeline`

**Steps:**
1. Trigger Facebook scraping via API
2. Wait for trigger audit log
3. Ingest mock warm leads
4. Wait for leads to be inserted
5. Wait for enrichment
6. Verify enriched data
7. Wait for outreach generation
8. Validate draft outreach
9. Admin approves outreach
10. Verify approval
11. Admin sends outreach
12. Verify send
13. Validate contact status updated

**Estimated Duration:** 90 seconds

**Tags:** `warm-leads`, `outreach`, `pipeline`, `critical-path`, `admin`

#### Mock Data Generator

**File:** `lib/testing/mock-warm-leads.ts`

**Functions:**
- `generateMockFacebookLeads(count)` - Generate Facebook leads
- `generateMockGoogleContactsLeads(count)` - Generate Google Contacts leads
- `generateMockLinkedInLeads(count)` - Generate LinkedIn leads
- `generateMockWarmLeads(config)` - Generate all sources
- `ingestMockWarmLeads(leads, authToken)` - Ingest via API
- `generateSingleTestLead(source)` - Quick test lead

**Example Usage:**
```typescript
import { generateMockWarmLeads, ingestMockWarmLeads } from '@/lib/testing/mock-warm-leads'

// Generate 10 Facebook leads, 5 LinkedIn leads
const leads = generateMockWarmLeads({
  facebook: 10,
  linkedin: 5
})

// Ingest them
await ingestMockWarmLeads(leads, authToken)
```

#### Test Client Handlers

**File:** `lib/testing/test-client.ts`

**New Methods:**
- `executeApiCall(step)` - Execute HTTP API calls with auth
- `executeAdminAction(step)` - Execute admin actions
- `executeWaitForData(step)` - Poll database until data appears

**Features:**
- Auto-authentication for admin endpoints
- Response validation
- Timeout handling
- Detailed error messages

### 5. Admin Testing Dashboard

**File:** `app/admin/testing/page.tsx`

**Updates:**
- Added "Warm Lead Pipeline" to scenarios list
- Tagged as `critical` path test
- Available in test run configuration

## Integration Points

### n8n Workflows → Next.js API

**Workflow:** WF-WRM-001, WF-WRM-002, WF-WRM-003
**Endpoint:** POST /api/admin/outreach/ingest
**Authentication:** N8N_INGEST_SECRET header

### Next.js Admin Dashboard → n8n Workflows

**UI:** /admin/outreach/dashboard
**API:** POST /api/admin/outreach/trigger
**Integration:** `lib/n8n.ts` - `triggerWarmLeadScrape()`

### E2E Tests → Complete Pipeline

**Framework:** `lib/testing/`
**Entry Point:** /admin/testing
**Coverage:** Trigger → Ingest → Enrich → Generate → Review → Send

## Environment Variables

### Required for Production

```bash
# n8n Webhook URLs (for triggering workflows)
N8N_WRM001_WEBHOOK_URL=https://n8n.amadutown.com/webhook/...
N8N_WRM002_WEBHOOK_URL=https://n8n.amadutown.com/webhook/...
N8N_WRM003_WEBHOOK_URL=https://n8n.amadutown.com/webhook/...

# n8n Ingest Secret (for receiving scraped data)
N8N_INGEST_SECRET=your-secret-key-here

# n8n Credentials (set in n8n Cloud)
APIFY_TOKEN=apify_api_...
LINKEDIN_COOKIE=li_at=...
FACEBOOK_COOKIE=...
GOOGLE_OAUTH_TOKEN=...
```

### Required for Testing

```bash
# Same as production
N8N_INGEST_SECRET=your-secret-key-here

# Test environment
NEXT_PUBLIC_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Testing

### Manual Testing

1. **Apply Database Schemas in Order** (see [database-setup-order.md](./database-setup-order.md))
   ```bash
   # Run these in order:
   psql -h your-db-host -U postgres -d your-db < database_schema_base_contacts.sql
   psql -h your-db-host -U postgres -d your-db < database_schema_contact_update.sql
   psql -h your-db-host -U postgres -d your-db < database_schema_cold_lead_pipeline.sql
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Navigate to Dashboard**
   - Go to http://localhost:3000/admin/outreach/dashboard
   - Log in as admin
   - Expand "Trigger Warm Lead Scraping" section
   - Click "Trigger" for Facebook source
   - Verify success message appears
   - Check trigger history in database

4. **Test Ingestion**
   ```bash
   curl -X POST http://localhost:3000/api/admin/outreach/ingest \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_N8N_INGEST_SECRET" \
     -d '{
       "leads": [
         {
           "name": "Test Lead",
           "email": "test@example.com",
           "lead_source": "warm_facebook_friends",
           "relationship_strength": "strong"
         }
       ]
     }'
   ```

5. **Verify in Database**
   ```sql
   SELECT * FROM warm_lead_trigger_audit ORDER BY triggered_at DESC LIMIT 5;
   SELECT * FROM contact_submissions WHERE lead_source LIKE 'warm_%' ORDER BY created_at DESC LIMIT 5;
   ```

### Automated E2E Testing

1. **Navigate to Testing Dashboard**
   - Go to http://localhost:3000/admin/testing
   - Log in as admin

2. **Configure Test Run**
   - Select "Warm Lead Pipeline" scenario
   - Choose a persona (e.g., "Tech Founder")
   - Set client count (1 for single test)
   - Enable "Use Mock Chat" for faster testing

3. **Run Test**
   - Click "Start Test Run"
   - Watch live activity feed
   - View step-by-step progress
   - Check for errors

4. **Review Results**
   - Check test completion status
   - Review validation results
   - Examine any errors
   - View created data in database

### Programmatic Testing

```typescript
import { SimulatedClient } from '@/lib/testing/test-client'
import { warmLeadPipelineScenario } from '@/lib/testing/scenarios'
import { testPersonas } from '@/lib/testing/personas'

const client = new SimulatedClient({
  persona: testPersonas[0],
  scenario: warmLeadPipelineScenario,
  testRunId: 'manual-test-123',
  clientId: 'client-1',
  useMockChat: true
})

const result = await client.run()
console.log('Test result:', result)
```

## Monitoring

### Trigger History

**Query:**
```sql
SELECT 
  id,
  source,
  status,
  leads_found,
  leads_inserted,
  triggered_at,
  completed_at,
  error_message
FROM warm_lead_trigger_audit
WHERE triggered_at > NOW() - INTERVAL '7 days'
ORDER BY triggered_at DESC;
```

### Pipeline Performance

**Query:**
```sql
WITH pipeline_stats AS (
  SELECT 
    lead_source,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE outreach_status = 'contacted') as contacted,
    COUNT(*) FILTER (WHERE outreach_status = 'replied') as replied,
    AVG(EXTRACT(EPOCH FROM (first_contacted_at - created_at))) as avg_time_to_contact
  FROM contact_submissions
  WHERE lead_source LIKE 'warm_%'
    AND created_at > NOW() - INTERVAL '30 days'
  GROUP BY lead_source
)
SELECT * FROM pipeline_stats;
```

### E2E Test Results

**Query:**
```sql
SELECT 
  tr.run_id,
  tr.started_at,
  tr.status,
  tr.clients_spawned,
  tr.clients_completed,
  tr.clients_failed,
  COUNT(te.id) as error_count
FROM test_runs tr
LEFT JOIN test_errors te ON te.test_run_id = tr.id
WHERE tr.config->>'scenarioId' = 'warm_lead_pipeline'
  AND tr.started_at > NOW() - INTERVAL '7 days'
GROUP BY tr.id
ORDER BY tr.started_at DESC;
```

## Troubleshooting

### Issue: Trigger API returns 401

**Cause:** Not authenticated as admin
**Solution:** 
1. Log in at /admin/login
2. Verify user role is 'admin' in user_profiles table
3. Check session token in cookies

### Issue: No leads inserted after trigger

**Possible Causes:**
1. n8n workflow not configured
2. Invalid webhook URL
3. n8n credentials expired
4. Rate limiting by source platform

**Solution:**
1. Check n8n workflow execution logs
2. Verify environment variables
3. Test webhook URL manually
4. Check warm_lead_trigger_audit for error messages

### Issue: E2E test fails at "Wait for data"

**Cause:** Background workflows not running or delayed
**Solution:**
1. Increase timeout in test scenario
2. Check if enrichment workflow is active
3. Verify outreach generation workflow is running
4. Check database for actual data

### Issue: Database error on insert

**Cause:** Schema not applied or migration failed
**Solution:**
1. Run database schema SQL file
2. Check for existing tables
3. Verify RLS policies are correct
4. Check user permissions

## Deployment Checklist

- [ ] Apply database schema to production
- [ ] Set all environment variables in production
- [ ] Configure n8n workflows in n8n Cloud
- [ ] Test trigger API from admin dashboard
- [ ] Verify webhook URLs are accessible
- [ ] Run E2E test in staging environment
- [ ] Check monitoring queries
- [ ] Set up error alerting
- [ ] Document any production-specific config
- [ ] Train team on new features

## Future Enhancements

1. **Automated Trigger Scheduling**
   - UI to configure daily/weekly triggers
   - Store schedule in database
   - Use cron jobs or scheduled functions

2. **Advanced Filtering**
   - Filter by relationship strength
   - Filter by company size/industry
   - Smart lead scoring

3. **Batch Operations**
   - Bulk approve/reject
   - Batch editing of messages
   - Mass send with delays

4. **Analytics Dashboard**
   - Lead source performance
   - Conversion rates by source
   - Time-to-contact metrics
   - Response rate tracking

5. **Webhook Status Updates**
   - n8n sends progress updates
   - Real-time lead count
   - Completion notifications

## Resources

- [n8n Workflows Documentation](/n8n-exports/README.md)
- [Environment Variables Reference](/n8n-exports/environment-variables-reference.md)
- [E2E Testing Framework](/lib/testing/README.md)
- [Cold Lead Pipeline Schema](/database_schema_cold_lead_pipeline.sql)
