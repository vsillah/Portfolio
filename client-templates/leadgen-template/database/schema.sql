-- Lead Generation Template Database Schema
-- Run this in your Supabase SQL editor

-- ============================================================================
-- Contact Submissions (Leads)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_submissions (
  id BIGSERIAL PRIMARY KEY,
  
  -- Contact Information
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  company_domain TEXT,
  linkedin_url TEXT,
  message TEXT NOT NULL,
  
  -- Lead Qualification Fields
  annual_revenue TEXT,
  interest_areas TEXT[],
  interest_summary TEXT,
  is_decision_maker BOOLEAN DEFAULT FALSE,
  
  -- Lead Scoring (populated by n8n workflow)
  lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
  qualification_status TEXT DEFAULT 'pending' CHECK (qualification_status IN ('pending', 'qualified', 'hot', 'warm', 'cold')),
  
  -- AI Enrichment (populated by n8n workflow)
  full_report TEXT,
  ai_readiness_score INTEGER,
  competitive_pressure_score INTEGER,
  quick_wins TEXT[],
  key_stakeholders TEXT[],
  potential_recommendations TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Lead Magnets
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_magnets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead magnet download tracking
CREATE TABLE IF NOT EXISTS lead_magnet_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE CASCADE,
  email TEXT,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT
);

-- ============================================================================
-- Diagnostic Audits (Self-assessment from chat or forms)
-- ============================================================================

CREATE TABLE IF NOT EXISTS diagnostic_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to contact submission (if email provided)
  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  
  -- Diagnostic data (JSONB for flexibility)
  business_challenges JSONB DEFAULT '{}',
  tech_stack JSONB DEFAULT '{}',
  automation_needs JSONB DEFAULT '{}',
  ai_readiness JSONB DEFAULT '{}',
  budget_timeline JSONB DEFAULT '{}',
  decision_making JSONB DEFAULT '{}',
  
  -- Summary and insights (populated on completion)
  diagnostic_summary TEXT,
  key_insights TEXT[],
  recommended_actions TEXT[],
  
  -- Sales enablement
  urgency_score INTEGER CHECK (urgency_score >= 0 AND urgency_score <= 10),
  opportunity_score INTEGER CHECK (opportunity_score >= 0 AND opportunity_score <= 10),
  sales_notes TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Sales Sessions (for admin follow-up)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to diagnostic audit
  diagnostic_audit_id UUID REFERENCES diagnostic_audits(id) ON DELETE SET NULL,
  
  -- Client info
  client_name TEXT,
  client_email TEXT,
  client_company TEXT,
  
  -- Sales agent
  sales_agent_id UUID REFERENCES auth.users(id),
  
  -- Session state
  funnel_stage TEXT NOT NULL DEFAULT 'prospect' CHECK (funnel_stage IN (
    'prospect', 'interested', 'informed', 'converted', 'active', 'upgraded'
  )),
  
  -- Tracking
  notes TEXT,
  
  -- Outcome
  outcome TEXT CHECK (outcome IN (
    'converted', 'downsold', 'deferred', 'lost', 'in_progress'
  )) DEFAULT 'in_progress',
  
  -- Follow-up
  next_follow_up TIMESTAMPTZ,
  follow_up_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- User Profiles (for admin access)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_lead_score ON contact_submissions(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions(qualification_status);

CREATE INDEX IF NOT EXISTS idx_lead_magnets_active ON lead_magnets(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_lead_magnet_downloads_user ON lead_magnet_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_magnet_downloads_lead_magnet ON lead_magnet_downloads(lead_magnet_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_contact ON diagnostic_audits(contact_submission_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_status ON diagnostic_audits(status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_completed_at ON diagnostic_audits(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_sessions_audit ON sales_sessions(diagnostic_audit_id);
CREATE INDEX IF NOT EXISTS idx_sales_sessions_outcome ON sales_sessions(outcome);
CREATE INDEX IF NOT EXISTS idx_sales_sessions_follow_up ON sales_sessions(next_follow_up);

-- ============================================================================
-- Update Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_submissions_updated_at ON contact_submissions;
CREATE TRIGGER contact_submissions_updated_at
  BEFORE UPDATE ON contact_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS lead_magnets_updated_at ON lead_magnets;
CREATE TRIGGER lead_magnets_updated_at
  BEFORE UPDATE ON lead_magnets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS diagnostic_audits_updated_at ON diagnostic_audits;
CREATE TRIGGER diagnostic_audits_updated_at
  BEFORE UPDATE ON diagnostic_audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS sales_sessions_updated_at ON sales_sessions;
CREATE TRIGGER sales_sessions_updated_at
  BEFORE UPDATE ON sales_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_magnet_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Contact submissions: Anyone can create, admins can read all
CREATE POLICY "Anyone can create contact submissions"
  ON contact_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage contact submissions"
  ON contact_submissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Lead magnets: Public read for active, admin manage
CREATE POLICY "Public can view active lead magnets"
  ON lead_magnets FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage lead magnets"
  ON lead_magnets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Lead magnet downloads: Users can track their own, admins see all
CREATE POLICY "Users can create downloads"
  ON lead_magnet_downloads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own downloads"
  ON lead_magnet_downloads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage downloads"
  ON lead_magnet_downloads FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Diagnostic audits: Public create/read, admin manage
CREATE POLICY "Anyone can create diagnostic audits"
  ON diagnostic_audits FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update diagnostic audits"
  ON diagnostic_audits FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read diagnostic audits"
  ON diagnostic_audits FOR SELECT TO anon, authenticated
  USING (true);

-- Sales sessions: Admin only
CREATE POLICY "Admins can manage sales sessions"
  ON sales_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- User profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON contact_submissions TO anon, authenticated;
GRANT ALL ON lead_magnets TO anon, authenticated;
GRANT ALL ON lead_magnet_downloads TO authenticated;
GRANT ALL ON diagnostic_audits TO anon, authenticated;
GRANT ALL ON sales_sessions TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE contact_submissions_id_seq TO anon, authenticated;
