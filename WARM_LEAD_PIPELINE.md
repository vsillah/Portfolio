# Warm Lead Scraping, Enrichment & Outreach Pipeline

> End-to-end plan for scraping warm leads from social media, enriching them with
> 3rd-party data (Apollo, Apify), finding commonalities, and feeding them into the
> existing sales outreach workflow.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Pipeline Stages](#2-pipeline-stages)
3. [Stage 1 — Lead Sourcing & Scraping](#3-stage-1--lead-sourcing--scraping)
4. [Stage 2 — Data Enrichment](#4-stage-2--data-enrichment)
5. [Stage 3 — Commonality Analysis](#5-stage-3--commonality-analysis)
6. [Stage 4 — Personalized Outreach Drafting](#6-stage-4--personalized-outreach-drafting)
7. [Stage 5 — Integration with Existing Sales Pipeline](#7-stage-5--integration-with-existing-sales-pipeline)
8. [n8n Workflow Design](#8-n8n-workflow-design)
9. [Database Schema](#9-database-schema)
10. [API Endpoints](#10-api-endpoints)
11. [Environment Variables](#11-environment-variables)
12. [Setup Checklist](#12-setup-checklist)
13. [Cost Estimates](#13-cost-estimates)
14. [Privacy & Compliance Notes](#14-privacy--compliance-notes)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         LEAD SOURCES                                 │
│  LinkedIn │ Twitter/X │ Instagram │ Apollo Search │ CSV │ Referrals  │
└──────────┬──────────┬──────────┬──────────┬─────────┬──────────────┘
           │          │          │          │         │
           ▼          ▼          ▼          ▼         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    APIFY SCRAPERS (via n8n)                           │
│  LinkedIn Profile │ Twitter Profile │ Instagram Profile │ Google     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    WARM LEADS TABLE (Supabase)                       │
│  full_name, email, company, social profiles, source, tags            │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                   ┌───────────┴───────────┐
                   ▼                       ▼
┌─────────────────────────┐  ┌─────────────────────────────────────────┐
│   APOLLO ENRICHMENT     │  │        SOCIAL MEDIA SCRAPING            │
│  • Company data         │  │  • LinkedIn posts & experience          │
│  • Verified emails      │  │  • Twitter/X tweets & topics            │
│  • Phone numbers        │  │  • Instagram posts & bio                │
│  • Tech stack           │  │  • Shared connections                   │
│  • Seniority / Title    │  │  • Recent activity                     │
└────────────┬────────────┘  └──────────────┬──────────────────────────┘
             │                              │
             └──────────┬───────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│               AI COMMONALITY ANALYSIS (GPT/Claude via n8n)           │
│  • Shared interests, skills, connections                             │
│  • Geographic proximity                                              │
│  • Shared groups & events                                            │
│  • Relevance scoring (0-100)                                         │
│  • Talking points & icebreakers                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│            AI PERSONALIZED OUTREACH DRAFTING                         │
│  • Channel-appropriate message (email, LinkedIn DM, etc.)            │
│  • Leads with strongest commonality → highest priority               │
│  • Human review before sending                                       │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│           EXISTING SALES PIPELINE                                    │
│  contact_submissions → diagnostic_audits → sales_sessions            │
│  → offer_bundles → proposals → onboarding_plans                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pipeline Stages

| Stage | What Happens | Tools | Time |
|-------|-------------|-------|------|
| **1. Source** | Scrape / import warm leads | Apify, Apollo, CSV, Manual | Minutes |
| **2. Enrich** | Add company data, verified emails, tech stack | Apollo People API | ~2s/lead |
| **3. Scrape Social** | Pull recent posts, bio, connections | Apify actors | ~10s/lead |
| **4. Analyze** | AI finds shared interests, connections, icebreakers | GPT-4o / Claude | ~5s/lead |
| **5. Draft** | AI writes personalized outreach message | GPT-4o / Claude | ~3s/lead |
| **6. Review** | Human approves / edits message | Admin UI | Manual |
| **7. Send** | Outreach via email or DM | n8n + SendGrid/LinkedIn | Automated |
| **8. Follow Up** | Automated follow-up sequence | n8n schedule | 3-7-14 days |
| **9. Convert** | Move to sales pipeline when they respond | Webhook → sales_sessions | Automated |

---

## 3. Stage 1 — Lead Sourcing & Scraping

### Where to Find Warm Leads

| Source | Method | What You Get |
|--------|--------|-------------|
| **LinkedIn connections** | Apify `apify/linkedin-profile-scraper` | Name, headline, company, experience, education, skills |
| **LinkedIn Sales Navigator** | Export → CSV → `/api/admin/warm-leads/import` | Name, title, company, email (if available) |
| **Twitter/X followers** | Apify `apify/twitter-scraper` | Bio, tweets, topics, follower count |
| **Instagram followers** | Apify `apify/instagram-scraper` | Bio, posts, follower count |
| **Apollo People Search** | Apollo API `/v1/mixed_people/search` | Name, email, company, title, seniority, tech stack |
| **Conference attendees** | Manual CSV upload | Name, email, company |
| **Referral program** | Existing `referrals` system | Name, email, referrer context |
| **Website visitors** | Analytics identification | Email (if logged in), pages visited |

### Apify Actors to Use

| Actor | Purpose | Cost |
|-------|---------|------|
| `apify/linkedin-profile-scraper` | Scrape LinkedIn profiles by URL | ~$0.01/profile |
| `apify/linkedin-search-scraper` | Search LinkedIn for people matching criteria | ~$0.02/result |
| `apify/twitter-scraper` | Scrape Twitter profiles and tweets | ~$0.005/profile |
| `apify/instagram-scraper` | Scrape Instagram profiles | ~$0.005/profile |
| `apify/google-search-scraper` | Find additional public info | ~$0.005/search |

### Import Methods

**Manual (Admin UI):**
```
POST /api/admin/warm-leads
{
  "full_name": "Jane Smith",
  "linkedin_url": "https://linkedin.com/in/janesmith",
  "company": "Acme Corp",
  "source": "linkedin_scrape",
  "auto_enrich": true
}
```

**Bulk Import (CSV/Apollo export):**
```
POST /api/admin/warm-leads/import
{
  "source": "apollo_search",
  "source_detail": "AI founders, Series A+, Austin TX",
  "tags": ["ai-founders", "austin"],
  "auto_enrich": true,
  "leads": [
    { "full_name": "Jane Smith", "email": "jane@acme.com", ... },
    { "full_name": "John Doe", "linkedin_url": "...", ... }
  ]
}
```

**n8n Automated Scrape (recommended):**
The n8n workflow can be triggered on a schedule to scrape new leads from LinkedIn searches, Apollo saved searches, or Twitter lists, then auto-import them.

---

## 4. Stage 2 — Data Enrichment

### Apollo People Enrichment

Apollo's People Enrichment API takes an email or LinkedIn URL and returns:

- Verified work email + personal email
- Phone numbers (mobile, work)
- Current title + seniority level
- Company name, industry, size, revenue, tech stack
- Employment history
- Social profiles (LinkedIn, Twitter, GitHub)

**n8n Implementation:**

```
HTTP Request Node → Apollo API
POST https://api.apollo.io/api/v1/people/match
Headers: { "x-api-key": "{{$env.APOLLO_API_KEY}}" }
Body: {
  "email": "{{ $json.email }}",
  "linkedin_url": "{{ $json.linkedin_url }}",
  "first_name": "{{ $json.full_name.split(' ')[0] }}",
  "last_name": "{{ $json.full_name.split(' ').slice(1).join(' ') }}",
  "organization_name": "{{ $json.company }}"
}
```

### What Gets Stored

The raw Apollo response is stored in `warm_leads.apollo_data` (JSONB) so you always
have the original data. Key fields are also mapped to top-level columns:

| Apollo Field | → | warm_leads Column |
|---|---|---|
| `person.email` | → | `email` |
| `person.phone_numbers[0]` | → | `phone` |
| `person.title` | → | `job_title` |
| `person.organization.name` | → | `company` |
| `person.organization.primary_domain` | → | `company_domain` |
| `person.city` | → | `location` |

---

## 5. Stage 3 — Commonality Analysis

This is the most valuable step. After enrichment, the AI agent analyzes YOUR profile
and the lead's profile to find genuine commonalities.

### Your Profile (configured in n8n)

Store your own profile data as a static JSON in the n8n workflow (or in a Supabase
`system_config` table) so the AI can compare:

```json
{
  "name": "Your Name",
  "title": "Founder & AI Consultant",
  "company": "ATAS",
  "location": "Your City",
  "interests": ["AI automation", "n8n", "indie hacking", "basketball", "music production"],
  "skills": ["Next.js", "React", "n8n", "Supabase", "AI/ML", "sales automation"],
  "industries": ["SaaS", "consulting", "AI"],
  "groups": ["AI Builders Club", "Indie Hackers"],
  "recent_content": ["Published article on AI sales automation", "Spoke at AI Summit 2025"],
  "connections": ["Person A at Company X", "Person B at Company Y"]
}
```

### AI Commonality Prompt (used in n8n Code / AI Agent node)

```
You are a networking research assistant. Given two professional profiles,
identify genuine commonalities and craft authentic talking points.

## My Profile
{{ $json.my_profile }}

## Lead Profile
Name: {{ $json.lead.full_name }}
Title: {{ $json.lead.job_title }} at {{ $json.lead.company }}
Location: {{ $json.lead.location }}
LinkedIn Headline: {{ $json.lead.social_data.linkedin.headline }}
Skills: {{ $json.lead.social_data.linkedin.skills }}
Recent Posts: {{ $json.lead.social_data.linkedin.recent_posts }}
Twitter Bio: {{ $json.lead.social_data.twitter.bio }}
Recent Tweets: {{ $json.lead.social_data.twitter.recent_tweets }}
Apollo Data: {{ $json.lead.apollo_data }}

## Your Task
Return a JSON object with:
{
  "shared_connections": [],     // mutual connections or companies
  "shared_interests": [],       // topics, hobbies, passions
  "shared_industries": [],      // overlapping industry experience
  "shared_skills": [],          // technical or professional skills
  "shared_groups": [],          // communities, groups, organizations
  "shared_events": [],          // conferences, meetups, events
  "geographic_proximity": "",   // same city, region, or time zone
  "talking_points": [],         // 3-5 specific, genuine conversation starters
  "icebreakers": [],            // 2-3 ready-to-use opening lines
  "relevance_score": 0          // 0-100 how relevant/warm this lead is
}

Rules:
- Only include genuine, verifiable commonalities
- Talking points should be specific (mention actual posts, skills, events)
- Icebreakers should be conversational, not salesy
- Score ≥ 70 = strong commonality, worth reaching out
- Score 40-69 = moderate commonality, may be worth it
- Score < 40 = weak commonality, probably skip
```

### What Gets Stored

The output is stored in `warm_leads.commonalities` (JSONB). Example:

```json
{
  "shared_connections": ["John Smith at Acme Corp"],
  "shared_interests": ["AI automation", "indie SaaS", "basketball"],
  "shared_industries": ["SaaS", "consulting"],
  "shared_skills": ["n8n", "Next.js", "React"],
  "shared_groups": ["AI Builders Club"],
  "shared_events": [],
  "geographic_proximity": "Same city (Austin, TX)",
  "talking_points": [
    "Both build with n8n and Next.js — they recently posted about their n8n workflow for client onboarding",
    "Mutual connection with John Smith at Acme Corp who they worked with at their previous role",
    "Both interested in AI automation for sales — their recent LinkedIn post discussed lead scoring"
  ],
  "icebreakers": [
    "Saw your post about automating client onboarding with n8n — we built something similar. How's it working for you?",
    "John Smith mentioned we should connect — I think there's some interesting overlap in what we're building."
  ],
  "relevance_score": 82,
  "analyzed_at": "2026-02-07T12:00:00Z"
}
```

---

## 6. Stage 4 — Personalized Outreach Drafting

After commonalities are identified, the AI drafts a personalized message using the
strongest talking point. The message is stored in `warm_leads.personalized_message`
for **human review before sending**.

### AI Outreach Prompt

```
Write a personalized, warm outreach message to {{ lead.full_name }}.

## Lead Context
- Title: {{ lead.job_title }} at {{ lead.company }}
- Location: {{ lead.location }}

## What We Have in Common
{{ commonalities.talking_points | join('\n- ') }}

## Icebreaker Ideas
{{ commonalities.icebreakers | join('\n- ') }}

## Instructions
- Keep it under 150 words
- Lead with the strongest commonality or icebreaker
- Be genuine and conversational, not salesy
- End with a low-pressure question or soft CTA
- Do NOT mention that you scraped their data or used AI
- Match the tone to the channel (LinkedIn DM = professional-casual, email = slightly more formal)
```

### Example Output

> Hey Jane — saw your post about automating client onboarding with n8n.
> We actually built something really similar for our consulting practice
> and ran into a few interesting challenges around milestone tracking.
>
> Also noticed we're both in the AI Builders Club — small world!
>
> Would love to compare notes sometime. Are you free for a quick chat
> this week?

---

## 7. Stage 5 — Integration with Existing Sales Pipeline

When a warm lead **responds positively**, they flow into the existing pipeline:

```
warm_leads (responded)
    │
    ├─→ contact_submissions (auto-created)
    │       ↓
    ├─→ diagnostic_audits (optional: trigger via chat)
    │       ↓
    └─→ sales_sessions (created with warm lead context)
            ↓
        sales_scripts (guided conversation with Hormozi framework)
            ↓
        offer_bundles → proposals → onboarding_plans
```

### Auto-promotion to Sales Pipeline

When `outreach_status` changes to `replied` or `meeting_booked`:

1. **Create a `contact_submission`** with enriched data:
   - Name, email, company from warm_lead
   - `qualification_status = 'qualified'`
   - `lead_score` from enrichment
   - Link back via `warm_leads.contact_submission_id`

2. **Create a `sales_session`** with warm lead context:
   - `funnel_stage = 'interested'`
   - `client_responses` includes commonalities and outreach history
   - Link back via `warm_leads.sales_session_id`

3. **Log the activity** in `warm_lead_activities`:
   - `activity_type = 'moved_to_pipeline'`

---

## 8. n8n Workflow Design

### Workflow 1: Enrichment Pipeline

**Trigger:** Webhook (from app when lead is created/imported)

```
[Webhook Trigger]
    │
    ├─→ [IF] Has LinkedIn URL?
    │       ├─ YES → [Apify] LinkedIn Profile Scraper
    │       └─ NO  → skip
    │
    ├─→ [IF] Has Email or Name+Company?
    │       ├─ YES → [HTTP] Apollo People Match
    │       └─ NO  → skip
    │
    ├─→ [IF] Has Twitter URL?
    │       ├─ YES → [Apify] Twitter Profile Scraper
    │       └─ NO  → skip
    │
    ├─→ [Merge] Combine all enrichment data
    │
    ├─→ [AI Agent] Commonality Analysis
    │       Input: my_profile + lead enriched data
    │       Output: commonalities JSON
    │
    ├─→ [AI Agent] Draft Personalized Message
    │       Input: lead data + commonalities
    │       Output: personalized outreach text
    │
    ├─→ [Code] Calculate Lead Score
    │       Factors: relevance_score, seniority, company_size,
    │                budget_signals, engagement_signals
    │
    └─→ [HTTP] Callback to /api/webhooks/warm-lead-enriched
            Body: { apollo_data, social_data, commonalities,
                    personalized_message, lead_score }
```

### Workflow 2: Outreach Sequence

**Trigger:** Webhook (from app when admin approves outreach)

```
[Webhook Trigger]
    │
    ├─→ [Switch] Channel
    │       ├─ email     → [SendGrid / SMTP] Send email
    │       ├─ linkedin  → [LinkedIn API] Send InMail / DM
    │       └─ twitter   → [Twitter API] Send DM
    │
    ├─→ [HTTP] Update lead status → outreach_status = 'sent'
    │
    ├─→ [Wait] 3 days
    │       └─→ [IF] Reply received?
    │               ├─ YES → [HTTP] Update status → 'replied', promote to pipeline
    │               └─ NO  → [Send] Follow-up #1
    │
    ├─→ [Wait] 7 days
    │       └─→ [IF] Reply received?
    │               ├─ YES → promote to pipeline
    │               └─ NO  → [Send] Follow-up #2
    │
    └─→ [Wait] 14 days
            └─→ [IF] Reply received?
                    ├─ YES → promote to pipeline
                    └─ NO  → Mark as cold, move on
```

### Workflow 3: Scheduled Lead Discovery (Optional)

**Trigger:** Schedule (weekly)

```
[Schedule Trigger] (every Monday 9am)
    │
    ├─→ [Apollo] Saved Search: AI Founders, Series A+
    │
    ├─→ [Apify] LinkedIn Search: "AI consultant" in Austin
    │
    ├─→ [Merge + Dedupe] Against existing warm_leads
    │
    └─→ [HTTP] POST /api/admin/warm-leads/import
            Body: { leads: [...], source: 'apollo_search', auto_enrich: true }
```

---

## 9. Database Schema

The full schema is in `database_schema_warm_leads.sql`. Key tables:

| Table | Purpose |
|-------|---------|
| `warm_leads` | Master table for all scraped/imported leads |
| `warm_lead_activities` | Activity log for every touchpoint |

Key views:

| View | Purpose |
|------|---------|
| `warm_leads_outreach_ready` | Enriched, qualified, not yet contacted |
| `warm_leads_follow_up_due` | Leads with overdue follow-ups |
| `warm_lead_funnel` | Aggregated funnel metrics |

---

## 10. API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/admin/warm-leads` | List leads (with filters) |
| `POST` | `/api/admin/warm-leads` | Create single lead |
| `GET` | `/api/admin/warm-leads/:id` | Get lead + activity log |
| `PATCH` | `/api/admin/warm-leads/:id` | Update a lead |
| `DELETE` | `/api/admin/warm-leads/:id` | Delete a lead |
| `POST` | `/api/admin/warm-leads/import` | Bulk import (up to 500) |
| `POST` | `/api/admin/warm-leads/enrich` | Trigger enrichment |
| `POST` | `/api/webhooks/warm-lead-enriched` | Callback from n8n |

### Filters for GET `/api/admin/warm-leads`

| Param | Example | Description |
|-------|---------|-------------|
| `status` | `qualified` | Qualification status |
| `outreach` | `draft_ready` | Outreach status |
| `temperature` | `hot` | Lead temperature |
| `enrichment` | `enriched` | Enrichment status |
| `source` | `apollo_search` | Lead source |
| `search` | `jane` | Search name/email/company |
| `tag` | `ai-founders` | Filter by tag |
| `view` | `outreach_ready` | Use pre-built view |
| `limit` | `25` | Pagination limit |
| `offset` | `0` | Pagination offset |

---

## 11. Environment Variables

Add these to `.env.local` (and Vercel/production env):

```env
# ── Warm Lead Pipeline ──────────────────────────────────────────────
# n8n webhook URL for the enrichment pipeline workflow
N8N_WARM_LEAD_ENRICH_WEBHOOK_URL=https://your-n8n.com/webhook/warm-lead-enrich

# n8n webhook URL for the outreach sequence workflow
N8N_WARM_LEAD_OUTREACH_WEBHOOK_URL=https://your-n8n.com/webhook/warm-lead-outreach

# Shared secret for webhook authentication (set same value in n8n)
WARM_LEAD_WEBHOOK_SECRET=your-secret-here

# ── Apollo.io ────────────────────────────────────────────────────────
# API key from https://app.apollo.io/#/settings/integrations/api_keys
APOLLO_API_KEY=your-apollo-api-key

# ── Apify ────────────────────────────────────────────────────────────
# API token from https://console.apify.com/account/integrations
APIFY_API_TOKEN=your-apify-token
```

---

## 12. Setup Checklist

### Database
- [ ] Run `database_schema_warm_leads.sql` in Supabase SQL Editor
- [ ] Verify tables: `warm_leads`, `warm_lead_activities`
- [ ] Verify views: `warm_leads_outreach_ready`, `warm_leads_follow_up_due`, `warm_lead_funnel`

### API Keys
- [ ] Sign up for [Apollo.io](https://www.apollo.io/) (free tier: 600 credits/month)
- [ ] Get Apollo API key from Settings → Integrations → API Keys
- [ ] Sign up for [Apify](https://apify.com/) (free tier: $5/month credit)
- [ ] Get Apify API token from Account → Integrations

### n8n Workflows
- [ ] Create Workflow 1: Enrichment Pipeline
  - [ ] Add Webhook trigger node
  - [ ] Add Apollo HTTP Request node
  - [ ] Add Apify LinkedIn scraper node
  - [ ] Add Apify Twitter scraper node (optional)
  - [ ] Add AI Agent node for commonality analysis
  - [ ] Add AI Agent node for outreach drafting
  - [ ] Add Code node for lead scoring
  - [ ] Add HTTP Request node for callback
  - [ ] Test with a sample lead
  - [ ] Activate workflow
- [ ] Create Workflow 2: Outreach Sequence (optional — can start with manual outreach)
- [ ] Create Workflow 3: Scheduled Discovery (optional — can start with manual imports)

### Environment Variables
- [ ] Add `N8N_WARM_LEAD_ENRICH_WEBHOOK_URL` to `.env.local`
- [ ] Add `N8N_WARM_LEAD_OUTREACH_WEBHOOK_URL` to `.env.local`
- [ ] Add `WARM_LEAD_WEBHOOK_SECRET` to `.env.local`
- [ ] Add `APOLLO_API_KEY` to n8n credentials
- [ ] Add `APIFY_API_TOKEN` to n8n credentials
- [ ] Add all env vars to Vercel/production

### Testing
- [ ] Create a test warm lead via `POST /api/admin/warm-leads`
- [ ] Verify enrichment webhook fires to n8n
- [ ] Verify n8n processes and calls back to `/api/webhooks/warm-lead-enriched`
- [ ] Verify lead is updated with Apollo data, social data, commonalities
- [ ] Verify personalized message is generated
- [ ] Verify lead appears in `warm_leads_outreach_ready` view

---

## 13. Cost Estimates

### Per-Lead Costs (approximate)

| Service | Action | Cost |
|---------|--------|------|
| Apollo | People Match API | ~$0.01/credit (free: 600/month) |
| Apify | LinkedIn Profile Scrape | ~$0.01/profile |
| Apify | Twitter Profile Scrape | ~$0.005/profile |
| OpenAI | GPT-4o Commonality Analysis (~1K tokens in, ~500 out) | ~$0.005 |
| OpenAI | GPT-4o Outreach Drafting (~500 tokens in, ~200 out) | ~$0.002 |
| **Total** | **Per lead (full pipeline)** | **~$0.03** |

### Monthly Estimates

| Volume | Monthly Cost |
|--------|-------------|
| 100 leads/month | ~$3 + service fees |
| 500 leads/month | ~$15 + service fees |
| 1,000 leads/month | ~$30 + service fees |

> Apollo free tier gives 600 credits/month. Apify free tier gives $5/month.
> At low volumes, this pipeline is nearly free.

---

## 14. Privacy & Compliance Notes

- **LinkedIn ToS:** Automated scraping may violate LinkedIn's Terms of Service. Use Apify's compliant actors and respect rate limits. Consider using Apollo (which has licensed data) as the primary source.
- **GDPR/CCPA:** If targeting EU/California residents, ensure you have a legitimate interest basis and provide opt-out mechanisms.
- **CAN-SPAM:** Outreach emails must include an unsubscribe link and your physical address.
- **Data Retention:** Set up a policy to delete enrichment data for leads that don't convert within 90 days.
- **Consent:** When a lead responds and enters the sales pipeline, document their implicit consent to continue communication.
- **Apollo Compliance:** Apollo provides pre-consented business contact data. Their data comes from publicly available sources and opt-in databases.

### Recommendations

1. Start with Apollo as the primary data source (it's the most compliant).
2. Use Apify scrapers only for leads who have public profiles and haven't opted out.
3. Always give leads an easy way to opt out of further communication.
4. Don't store sensitive personal data beyond what's needed for outreach.
5. Regularly audit and clean your warm leads database.
