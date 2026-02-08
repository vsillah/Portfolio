# Documentation

This directory contains comprehensive documentation for the my-portfolio project.

## Available Documentation

### Warm Lead Workflow

- **[Warm Lead Workflow Integration](./warm-lead-workflow-integration.md)** - Complete guide to the warm lead pipeline, including:
  - Architecture overview
  - Component documentation
  - API endpoints
  - Database schema
  - E2E testing framework
  - Deployment checklist
  - Troubleshooting guide

## Quick Links

### Admin Dashboard
- **Outreach Dashboard**: `/admin/outreach/dashboard` - View metrics and manually trigger warm lead scraping
- **Outreach Review**: `/admin/outreach` - Review and manage AI-generated outreach messages
- **Testing Dashboard**: `/admin/testing` - Run E2E tests including warm lead pipeline tests

### API Endpoints
- `POST /api/admin/outreach/trigger` - Trigger warm lead scraping workflows
- `GET /api/admin/outreach/trigger` - Get trigger history
- `POST /api/admin/outreach/ingest` - Ingest scraped leads from n8n

### Key Files
- `lib/n8n.ts` - n8n integration functions
- `lib/testing/scenarios.ts` - E2E test scenarios
- `lib/testing/mock-warm-leads.ts` - Mock data generation
- `database_schema_cold_lead_pipeline.sql` - Database schema

### n8n Workflows
- `n8n-exports/WF-WRM-001-facebook-warm-leads.json` - Facebook scraper
- `n8n-exports/WF-WRM-002-google-contacts-warm-leads.json` - Google Contacts scraper
- `n8n-exports/WF-WRM-003-linkedin-warm-leads.json` - LinkedIn scraper

## Getting Started

### For Developers

1. **Set up environment variables** (see `.env.local.example`)
2. **Apply database schemas in order** (see [database-setup-order.md](./database-setup-order.md)):
   ```bash
   # Must run in this order!
   psql -h your-db-host -U postgres -d your-db < database_schema_base_contacts.sql
   psql -h your-db-host -U postgres -d your-db < database_schema_contact_update.sql
   psql -h your-db-host -U postgres -d your-db < database_schema_cold_lead_pipeline.sql
   ```
3. **Start development server**:
   ```bash
   npm run dev
   ```
4. **Run verification**:
   ```bash
   tsx scripts/verify-warm-lead-integration.ts
   ```

### For Testing

1. **Manual Testing**: Navigate to `/admin/outreach/dashboard` and use the trigger UI
2. **E2E Testing**: Navigate to `/admin/testing` and run the "Warm Lead Pipeline" scenario

### For n8n Setup

See `n8n-exports/README.md` for detailed workflow setup instructions.

## Architecture

```
Portfolio Website
├── Frontend (Next.js)
│   ├── Public Pages
│   ├── Admin Dashboard
│   └── E2E Testing UI
├── Backend (Next.js API Routes)
│   ├── Admin APIs
│   ├── Ingest APIs
│   └── Auth
├── Database (Supabase/Postgres)
│   ├── contact_submissions
│   ├── outreach_queue
│   ├── warm_lead_trigger_audit
│   └── test_runs
└── n8n Workflows
    ├── Warm Lead Scrapers
    ├── Enrichment
    └── Outreach Generation
```

## Support

For questions or issues:
1. Check the relevant documentation file
2. Review the troubleshooting section in `warm-lead-workflow-integration.md`
3. Check the codebase for inline comments and type definitions
