-- ============================================================================
-- Warm Lead Pipeline - Database Schema
-- ============================================================================
-- Extends the existing contact_submissions / qualified_leads system with
-- social-media scraping, 3rd-party enrichment (Apollo, Apify), and
-- commonality analysis so warm leads flow directly into the sales outreach
-- pipeline.
--
-- Run this in Supabase SQL Editor AFTER:
--   database_schema_contact_update.sql
--   database_schema_sales.sql
-- ============================================================================

-- ============================================================================
-- 1. warm_leads — master table for scraped / imported warm leads
-- ============================================================================
CREATE TABLE IF NOT EXISTS warm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Core identity ────────────────────────────────────────────────────────
  full_name           TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  company             TEXT,
  job_title           TEXT,
  company_domain      TEXT,
  location            TEXT,       -- city / region

  -- ── Social profiles (scraped) ────────────────────────────────────────────
  linkedin_url        TEXT,
  twitter_url         TEXT,
  instagram_url       TEXT,
  facebook_url        TEXT,
  github_url          TEXT,
  personal_website    TEXT,

  -- ── Source / provenance ──────────────────────────────────────────────────
  source              TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'manual',          -- added by hand
      'linkedin_scrape', -- Apify LinkedIn scraper
      'twitter_scrape',  -- Apify Twitter scraper
      'instagram_scrape',-- Apify Instagram scraper
      'apollo_search',   -- Apollo people search
      'csv_import',      -- bulk CSV upload
      'referral',        -- from referral program
      'event',           -- conference / meetup
      'website_visitor',  -- identified site visitor
      'other'
    )),
  source_detail       TEXT,        -- e.g. "LinkedIn Sales Nav list: AI Founders"
  source_url          TEXT,        -- original profile / page URL

  -- ── Enrichment status ────────────────────────────────────────────────────
  enrichment_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (enrichment_status IN (
      'pending',         -- just imported, not enriched yet
      'enriching',       -- enrichment workflow running
      'enriched',        -- all enrichment complete
      'partial',         -- some enrichments failed
      'failed'           -- enrichment entirely failed
    )),
  enriched_at         TIMESTAMPTZ, -- when enrichment last completed

  -- ── Apollo enrichment data ───────────────────────────────────────────────
  apollo_person_id    TEXT,        -- Apollo person ID for de-duplication
  apollo_data         JSONB DEFAULT '{}',
  -- Expected shape:
  -- {
  --   "headline": "...",
  --   "seniority": "senior",
  --   "departments": ["engineering"],
  --   "company_name": "...",
  --   "company_industry": "...",
  --   "company_size": "51-200",
  --   "company_revenue": "$10M-$50M",
  --   "company_technologies": ["React", "AWS", "Supabase"],
  --   "emails": [{ "email": "...", "type": "professional", "status": "verified" }],
  --   "phone_numbers": [{ "number": "...", "type": "mobile" }],
  --   "linkedin_url": "...",
  --   "twitter_url": "...",
  --   "employment_history": [{ "title": "...", "company": "...", "start": "...", "end": "..." }]
  -- }

  -- ── Social media scraped data ────────────────────────────────────────────
  social_data         JSONB DEFAULT '{}',
  -- Expected shape:
  -- {
  --   "linkedin": {
  --     "headline": "...",
  --     "summary": "...",
  --     "experience": [...],
  --     "education": [...],
  --     "skills": [...],
  --     "recent_posts": [...],
  --     "connections_count": 500,
  --     "scraped_at": "..."
  --   },
  --   "twitter": {
  --     "bio": "...",
  --     "followers": 1200,
  --     "recent_tweets": [...],
  --     "topics": [...],
  --     "scraped_at": "..."
  --   },
  --   "instagram": {
  --     "bio": "...",
  --     "followers": 800,
  --     "recent_posts": [...],
  --     "scraped_at": "..."
  --   }
  -- }

  -- ── Commonality analysis (AI-generated) ──────────────────────────────────
  commonalities       JSONB DEFAULT '{}',
  -- Expected shape:
  -- {
  --   "shared_connections": ["Person A", "Person B"],
  --   "shared_interests": ["AI automation", "indie hacking", "basketball"],
  --   "shared_industries": ["SaaS", "consulting"],
  --   "shared_skills": ["n8n", "Next.js"],
  --   "shared_groups": ["AI Builders Club"],
  --   "shared_events": ["ProductHunt launch day"],
  --   "geographic_proximity": "Same city (Austin, TX)",
  --   "talking_points": [
  --     "Both spoke at AI Summit 2025",
  --     "Mutual connection: John Smith at Acme Corp",
  --     "Both use n8n for automation"
  --   ],
  --   "icebreakers": [
  --     "Saw your post about [topic] — I had a similar experience with...",
  --     "We both know [mutual connection] — they mentioned you might be interested in..."
  --   ],
  --   "relevance_score": 85,
  --   "analyzed_at": "..."
  -- }

  -- ── Lead scoring & qualification ─────────────────────────────────────────
  lead_score          INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
  lead_temperature    TEXT DEFAULT 'warm'
    CHECK (lead_temperature IN ('cold', 'warm', 'hot')),
  qualification_status TEXT DEFAULT 'pending'
    CHECK (qualification_status IN (
      'pending',
      'researching',
      'qualified',
      'disqualified',
      'contacted',
      'responded',
      'meeting_scheduled',
      'converted',
      'lost'
    )),
  disqualification_reason TEXT,    -- why they were disqualified

  -- ── Outreach tracking ────────────────────────────────────────────────────
  outreach_status     TEXT DEFAULT 'not_started'
    CHECK (outreach_status IN (
      'not_started',
      'draft_ready',       -- personalized message drafted
      'queued',            -- in outreach queue
      'sent',              -- first touch sent
      'follow_up_1',       -- first follow-up sent
      'follow_up_2',       -- second follow-up sent
      'follow_up_3',       -- third follow-up sent
      'replied',           -- they responded
      'meeting_booked',    -- call/meeting scheduled
      'opted_out',         -- they asked to stop
      'bounced'            -- email bounced
    )),
  outreach_channel    TEXT CHECK (outreach_channel IN (
    'email', 'linkedin_dm', 'twitter_dm', 'instagram_dm', 'phone', 'other'
  )),
  personalized_message TEXT,       -- AI-drafted outreach message using commonalities
  outreach_notes      TEXT,
  last_outreach_at    TIMESTAMPTZ,
  next_follow_up_at   TIMESTAMPTZ,

  -- ── Link to existing pipeline ────────────────────────────────────────────
  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,
  sales_session_id    UUID REFERENCES sales_sessions(id) ON DELETE SET NULL,

  -- ── Tags & internal notes ────────────────────────────────────────────────
  tags                TEXT[] DEFAULT '{}',
  internal_notes      TEXT,
  assigned_to         UUID REFERENCES auth.users(id),

  -- ── Timestamps ───────────────────────────────────────────────────────────
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. warm_lead_activities — track every touchpoint with a warm lead
-- ============================================================================
CREATE TABLE IF NOT EXISTS warm_lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warm_lead_id UUID NOT NULL REFERENCES warm_leads(id) ON DELETE CASCADE,

  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'imported',          -- lead was imported / created
    'enriched',          -- enrichment data added
    'commonalities_found', -- commonality analysis completed
    'message_drafted',   -- personalized outreach drafted
    'outreach_sent',     -- outreach message sent
    'follow_up_sent',    -- follow-up sent
    'reply_received',    -- they responded
    'meeting_booked',    -- meeting scheduled
    'note_added',        -- internal note added
    'status_changed',    -- qualification status changed
    'score_updated',     -- lead score updated
    'moved_to_pipeline', -- promoted to sales pipeline
    'opted_out',         -- lead opted out
    'bounced'            -- message bounced
  )),

  description  TEXT,
  metadata     JSONB DEFAULT '{}',
  performed_by UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Indexes
-- ============================================================================

-- warm_leads
CREATE INDEX IF NOT EXISTS idx_warm_leads_email
  ON warm_leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warm_leads_linkedin
  ON warm_leads(linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warm_leads_apollo_id
  ON warm_leads(apollo_person_id) WHERE apollo_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warm_leads_source
  ON warm_leads(source);
CREATE INDEX IF NOT EXISTS idx_warm_leads_enrichment_status
  ON warm_leads(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_warm_leads_qualification
  ON warm_leads(qualification_status);
CREATE INDEX IF NOT EXISTS idx_warm_leads_outreach
  ON warm_leads(outreach_status);
CREATE INDEX IF NOT EXISTS idx_warm_leads_temperature
  ON warm_leads(lead_temperature);
CREATE INDEX IF NOT EXISTS idx_warm_leads_score
  ON warm_leads(lead_score DESC) WHERE lead_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warm_leads_follow_up
  ON warm_leads(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warm_leads_tags
  ON warm_leads USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_warm_leads_commonalities
  ON warm_leads USING GIN (commonalities);
CREATE INDEX IF NOT EXISTS idx_warm_leads_apollo_data
  ON warm_leads USING GIN (apollo_data);
CREATE INDEX IF NOT EXISTS idx_warm_leads_social_data
  ON warm_leads USING GIN (social_data);

-- warm_lead_activities
CREATE INDEX IF NOT EXISTS idx_warm_lead_activities_lead
  ON warm_lead_activities(warm_lead_id);
CREATE INDEX IF NOT EXISTS idx_warm_lead_activities_type
  ON warm_lead_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_warm_lead_activities_created
  ON warm_lead_activities(created_at DESC);

-- ============================================================================
-- 4. Updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_warm_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS warm_leads_updated_at ON warm_leads;
CREATE TRIGGER warm_leads_updated_at
  BEFORE UPDATE ON warm_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_warm_leads_updated_at();

-- ============================================================================
-- 5. Row Level Security
-- ============================================================================
ALTER TABLE warm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE warm_lead_activities ENABLE ROW LEVEL SECURITY;

-- Admin-only access to warm leads
DROP POLICY IF EXISTS "Admins can manage warm leads" ON warm_leads;
CREATE POLICY "Admins can manage warm leads"
  ON warm_leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage warm lead activities" ON warm_lead_activities;
CREATE POLICY "Admins can manage warm lead activities"
  ON warm_lead_activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 6. Useful views
-- ============================================================================

-- Warm leads ready for outreach (enriched, qualified, not yet contacted)
CREATE OR REPLACE VIEW warm_leads_outreach_ready AS
SELECT
  wl.*,
  wl.commonalities->>'relevance_score' AS relevance_score,
  array_length(
    ARRAY(SELECT jsonb_array_elements_text(wl.commonalities->'talking_points')),
    1
  ) AS talking_point_count
FROM warm_leads wl
WHERE wl.enrichment_status IN ('enriched', 'partial')
  AND wl.qualification_status = 'qualified'
  AND wl.outreach_status = 'not_started'
  AND wl.lead_temperature IN ('warm', 'hot')
ORDER BY wl.lead_score DESC NULLS LAST, wl.created_at ASC;

COMMENT ON VIEW warm_leads_outreach_ready IS
  'Warm leads that have been enriched and qualified but not yet contacted. Ordered by score for prioritized outreach.';

-- Warm leads needing follow-up
CREATE OR REPLACE VIEW warm_leads_follow_up_due AS
SELECT wl.*
FROM warm_leads wl
WHERE wl.next_follow_up_at IS NOT NULL
  AND wl.next_follow_up_at <= NOW()
  AND wl.outreach_status NOT IN ('opted_out', 'bounced', 'meeting_booked')
  AND wl.qualification_status NOT IN ('disqualified', 'converted', 'lost')
ORDER BY wl.next_follow_up_at ASC;

COMMENT ON VIEW warm_leads_follow_up_due IS
  'Warm leads with overdue follow-ups that need attention.';

-- Pipeline funnel metrics
CREATE OR REPLACE VIEW warm_lead_funnel AS
SELECT
  qualification_status,
  outreach_status,
  lead_temperature,
  COUNT(*) AS lead_count,
  AVG(lead_score) AS avg_score,
  COUNT(*) FILTER (WHERE enrichment_status = 'enriched') AS enriched_count
FROM warm_leads
GROUP BY qualification_status, outreach_status, lead_temperature
ORDER BY lead_count DESC;

COMMENT ON VIEW warm_lead_funnel IS
  'Aggregated funnel metrics for the warm lead pipeline.';

-- ============================================================================
-- 7. Comments
-- ============================================================================
COMMENT ON TABLE warm_leads IS 'Warm leads scraped from social media and enriched via Apollo/Apify, with AI-generated commonality analysis for personalized outreach.';
COMMENT ON TABLE warm_lead_activities IS 'Activity log tracking every touchpoint and status change for warm leads.';
COMMENT ON COLUMN warm_leads.commonalities IS 'AI-analyzed shared interests, connections, and experiences between the lead and the business owner. Used to personalize outreach.';
COMMENT ON COLUMN warm_leads.apollo_data IS 'Raw enrichment data from Apollo.io people enrichment API.';
COMMENT ON COLUMN warm_leads.social_data IS 'Scraped social media profiles and recent activity from Apify actors.';
COMMENT ON COLUMN warm_leads.personalized_message IS 'AI-drafted outreach message leveraging commonalities and enrichment data.';
