-- Chat Evaluation Template Database Schema
-- Run this in your Supabase SQL editor

-- NOTE: This template expects chat_sessions and chat_messages tables to exist
-- Either run this alongside the chatbot-template schema, or create those tables first

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
-- Evaluation Categories
-- Predefined categories for classifying issues
-- ============================================================================

CREATE TABLE IF NOT EXISTS evaluation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO evaluation_categories (name, description, color, sort_order) VALUES
  ('Transfer/handoff issues', 'Problems with escalation or handoff to human agents', '#EF4444', 1),
  ('Incorrect information provided', 'Factually wrong or misleading responses', '#EF4444', 2),
  ('Follow-up capability issues', 'Failures in follow-up actions or reminders', '#EAB308', 3),
  ('Tone or communication issues', 'Tone, clarity, or language problems', '#3B82F6', 4),
  ('Tool usage errors', 'Incorrect or failed tool/function calls', '#EC4899', 5),
  ('Markdown or formatting errors', 'Display or formatting issues in responses', '#8B5CF6', 6),
  ('Failed to answer question', 'Sessions where AI failed to respond appropriately', '#DC2626', 7),
  ('System prompt violation', 'Response violated system prompt guidelines', '#F97316', 8)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Open Codes
-- User-defined codes for uncategorized issues
-- ============================================================================

CREATE TABLE IF NOT EXISTS open_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  usage_count INT DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Chat Evaluations (Human Annotations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  
  -- Rating
  rating TEXT CHECK (rating IN ('good', 'bad')),
  
  -- Feedback
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Categorization
  category_id UUID REFERENCES evaluation_categories(id) ON DELETE SET NULL,
  open_code TEXT,
  
  -- Audit trail
  evaluated_by UUID REFERENCES auth.users(id),
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id, message_id)
);

-- ============================================================================
-- LLM Judge Evaluations
-- Automated assessments
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_judge_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  
  -- LLM Assessment
  rating TEXT NOT NULL CHECK (rating IN ('good', 'bad')),
  reasoning TEXT NOT NULL,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Categories identified by LLM
  identified_categories TEXT[] DEFAULT '{}',
  
  -- Model info
  model_used TEXT NOT NULL,
  prompt_version TEXT DEFAULT 'v1',
  
  -- Human alignment tracking
  human_evaluation_id UUID REFERENCES chat_evaluations(id) ON DELETE SET NULL,
  human_alignment BOOLEAN,
  
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id, message_id, model_used, prompt_version)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chat_evaluations_session_id ON chat_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_evaluations_rating ON chat_evaluations(rating);
CREATE INDEX IF NOT EXISTS idx_chat_evaluations_category_id ON chat_evaluations(category_id);
CREATE INDEX IF NOT EXISTS idx_chat_evaluations_evaluated_at ON chat_evaluations(evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_judge_session_id ON llm_judge_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_llm_judge_rating ON llm_judge_evaluations(rating);
CREATE INDEX IF NOT EXISTS idx_llm_judge_human_alignment ON llm_judge_evaluations(human_alignment);

CREATE INDEX IF NOT EXISTS idx_open_codes_code ON open_codes(code);
CREATE INDEX IF NOT EXISTS idx_open_codes_usage ON open_codes(usage_count DESC);

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_eval_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_evaluations_updated_at ON chat_evaluations;
CREATE TRIGGER chat_evaluations_updated_at
  BEFORE UPDATE ON chat_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_eval_updated_at();

-- Human-LLM alignment trigger
CREATE OR REPLACE FUNCTION update_llm_judge_alignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rating IS NOT NULL THEN
    UPDATE llm_judge_evaluations
    SET 
      human_evaluation_id = NEW.id,
      human_alignment = (rating = NEW.rating)
    WHERE session_id = NEW.session_id
      AND (message_id = NEW.message_id OR (message_id IS NULL AND NEW.message_id IS NULL))
      AND human_evaluation_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_llm_judge_alignment ON chat_evaluations;
CREATE TRIGGER trigger_update_llm_judge_alignment
  AFTER INSERT OR UPDATE ON chat_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_llm_judge_alignment();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_judge_evaluations ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Evaluation categories: read for all, write for admin
CREATE POLICY "Anyone can read categories"
  ON evaluation_categories FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON evaluation_categories FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Open codes: read for all, write for admin
CREATE POLICY "Anyone can read open codes"
  ON open_codes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage open codes"
  ON open_codes FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Chat evaluations: admin only
CREATE POLICY "Admins can manage evaluations"
  ON chat_evaluations FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

-- LLM judge evaluations: admin only
CREATE POLICY "Admins can manage llm evaluations"
  ON llm_judge_evaluations FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT ON user_profiles TO authenticated;
GRANT SELECT ON evaluation_categories TO authenticated;
GRANT SELECT ON open_codes TO authenticated;
GRANT ALL ON chat_evaluations TO authenticated;
GRANT ALL ON llm_judge_evaluations TO authenticated;

-- ============================================================================
-- Session Summary View
-- ============================================================================

CREATE OR REPLACE VIEW chat_eval_session_summary AS
SELECT 
  cs.session_id,
  cs.visitor_name,
  cs.visitor_email,
  cs.is_escalated,
  cs.created_at,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM chat_messages cm 
      WHERE cm.session_id = cs.session_id 
      AND cm.metadata->>'source' = 'voice'
    ) THEN 'voice'
    ELSE 'text'
  END as channel,
  
  (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.session_id) as message_count,
  
  ce.id as evaluation_id,
  ce.rating,
  ce.notes,
  ce.category_id,
  ec.name as category_name,
  ce.open_code,
  ce.evaluated_at,
  
  lje.rating as llm_rating,
  lje.confidence_score as llm_confidence,
  lje.human_alignment
  
FROM chat_sessions cs
LEFT JOIN chat_evaluations ce ON cs.session_id = ce.session_id AND ce.message_id IS NULL
LEFT JOIN evaluation_categories ec ON ce.category_id = ec.id
LEFT JOIN llm_judge_evaluations lje ON cs.session_id = lje.session_id AND lje.message_id IS NULL;

GRANT SELECT ON chat_eval_session_summary TO authenticated;
