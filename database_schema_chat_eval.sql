-- Chat Evaluation Schema for LLM Grader
-- Run this in your Supabase SQL editor

-- ============================================================================
-- Evaluation Categories Table
-- Predefined categories for classifying issues (e.g., "Transfer/handoff issues")
-- ============================================================================
CREATE TABLE IF NOT EXISTS evaluation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6B7280', -- Tailwind gray-500
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories based on the LLM Grader screenshots
INSERT INTO evaluation_categories (name, description, color, sort_order) VALUES
  ('Transfer/handoff issues', 'Problems with escalation or handoff to human agents', '#EF4444', 1),
  ('Tour scheduling issues', 'Errors in scheduling or booking appointments', '#F97316', 2),
  ('Follow-up capability issues', 'Failures in follow-up actions or reminders', '#EAB308', 3),
  ('Incorrect information provided', 'Factually wrong or misleading responses', '#EF4444', 4),
  ('Availability and lease term issues', 'Errors related to availability or terms', '#F97316', 5),
  ('Mailing list/unsubscription issues', 'Problems with email list management', '#6B7280', 6),
  ('Test cases with no response', 'Sessions where AI failed to respond', '#DC2626', 7),
  ('Markdown or formatting errors', 'Display or formatting issues in responses', '#8B5CF6', 8),
  ('Language or communication issues', 'Tone, clarity, or language problems', '#3B82F6', 9),
  ('Tool usage errors', 'Incorrect or failed tool/function calls', '#EC4899', 10)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Open Codes Table
-- User-defined codes for uncategorized or new issue types
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
-- Chat Evaluations Table
-- Human annotations for chat sessions
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
  
  -- Ensure one evaluation per session (or per message if message_id specified)
  UNIQUE(session_id, message_id)
);

-- ============================================================================
-- LLM Judge Evaluations Table
-- Automated assessments by LLM-as-a-judge
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
  human_alignment BOOLEAN, -- NULL until human reviews, TRUE if matches, FALSE if differs
  
  -- Timestamps
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Allow multiple LLM evaluations per session (different models/versions)
  UNIQUE(session_id, message_id, model_used, prompt_version)
);

-- ============================================================================
-- Evaluation Queues Table
-- Named queues for organizing evaluation work
-- ============================================================================
CREATE TABLE IF NOT EXISTS evaluation_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Filter criteria (stored as JSON for flexibility)
  filter_criteria JSONB DEFAULT '{}',
  -- Example: {"channel": "voice", "date_from": "2025-01-01", "rating": null}
  
  -- Stats (updated via trigger or manually)
  total_sessions INT DEFAULT 0,
  annotated_count INT DEFAULT 0,
  good_count INT DEFAULT 0,
  bad_count INT DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default queues based on channel types
INSERT INTO evaluation_queues (name, description, filter_criteria) VALUES
  ('All Text Messages', 'Text chat conversations', '{"channel": "text"}'),
  ('All Voice', 'Voice call conversations', '{"channel": "voice"}'),
  ('All Emails', 'Email-based interactions', '{"channel": "email"}'),
  ('All ChatBot', 'Chatbot interactions', '{"channel": "chatbot"}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Indexes for Performance
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
-- Update Triggers
-- ============================================================================

-- Update timestamp trigger for chat_evaluations
CREATE OR REPLACE FUNCTION update_chat_evaluation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_evaluation_updated_at ON chat_evaluations;
CREATE TRIGGER trigger_update_chat_evaluation_updated_at
  BEFORE UPDATE ON chat_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_evaluation_updated_at();

-- Update timestamp trigger for evaluation_categories
DROP TRIGGER IF EXISTS trigger_update_evaluation_categories_updated_at ON evaluation_categories;
CREATE TRIGGER trigger_update_evaluation_categories_updated_at
  BEFORE UPDATE ON evaluation_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_evaluation_updated_at();

-- Update timestamp trigger for evaluation_queues
DROP TRIGGER IF EXISTS trigger_update_evaluation_queues_updated_at ON evaluation_queues;
CREATE TRIGGER trigger_update_evaluation_queues_updated_at
  BEFORE UPDATE ON evaluation_queues
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_evaluation_updated_at();

-- ============================================================================
-- Human-LLM Alignment Trigger
-- Automatically updates alignment when human evaluation is linked
-- ============================================================================
CREATE OR REPLACE FUNCTION update_llm_judge_alignment()
RETURNS TRIGGER AS $$
BEGIN
  -- When a human evaluation is updated, check if there's a matching LLM evaluation
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
  FOR EACH ROW
  EXECUTE FUNCTION update_llm_judge_alignment();

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================
ALTER TABLE evaluation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_judge_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_queues ENABLE ROW LEVEL SECURITY;

-- Admin-only access for all evaluation tables
-- Note: These policies require an is_admin() function or checking user_profiles

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Evaluation Categories: Read for all authenticated, write for admin
CREATE POLICY "Anyone can read evaluation categories"
  ON evaluation_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage evaluation categories"
  ON evaluation_categories
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Open Codes: Read for all authenticated, write for admin
CREATE POLICY "Anyone can read open codes"
  ON open_codes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage open codes"
  ON open_codes
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Chat Evaluations: Admin only
CREATE POLICY "Admins can manage chat evaluations"
  ON chat_evaluations
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- LLM Judge Evaluations: Admin only
CREATE POLICY "Admins can manage llm judge evaluations"
  ON llm_judge_evaluations
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Evaluation Queues: Admin only
CREATE POLICY "Admins can manage evaluation queues"
  ON evaluation_queues
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT SELECT ON evaluation_categories TO authenticated;
GRANT SELECT ON open_codes TO authenticated;
GRANT ALL ON chat_evaluations TO authenticated;
GRANT ALL ON llm_judge_evaluations TO authenticated;
GRANT ALL ON evaluation_queues TO authenticated;

-- ============================================================================
-- Views for Statistics
-- ============================================================================

-- Session evaluation summary view
CREATE OR REPLACE VIEW chat_eval_session_summary AS
SELECT 
  cs.session_id,
  cs.visitor_name,
  cs.visitor_email,
  cs.is_escalated,
  cs.created_at,
  cs.updated_at,
  
  -- Channel detection from messages
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM chat_messages cm 
      WHERE cm.session_id = cs.session_id 
      AND cm.metadata->>'source' = 'voice'
    ) THEN 'voice'
    ELSE 'text'
  END as channel,
  
  -- Message counts
  (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.session_id) as message_count,
  
  -- Evaluation status
  ce.id as evaluation_id,
  ce.rating,
  ce.notes,
  ce.category_id,
  ec.name as category_name,
  ce.open_code,
  ce.evaluated_at,
  
  -- LLM Judge status
  lje.rating as llm_rating,
  lje.confidence_score as llm_confidence,
  lje.human_alignment
  
FROM chat_sessions cs
LEFT JOIN chat_evaluations ce ON cs.session_id = ce.session_id AND ce.message_id IS NULL
LEFT JOIN evaluation_categories ec ON ce.category_id = ec.id
LEFT JOIN llm_judge_evaluations lje ON cs.session_id = lje.session_id AND lje.message_id IS NULL;

-- Grant access to the view
GRANT SELECT ON chat_eval_session_summary TO authenticated;

-- ============================================================================
-- Axial Coding Tables
-- For qualitative research workflow: open codes → axial codes → categories
-- ============================================================================

-- Extend evaluation_categories to track origin
ALTER TABLE evaluation_categories 
ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('manual', 'axial_code')) DEFAULT 'manual';

ALTER TABLE evaluation_categories 
ADD COLUMN IF NOT EXISTS axial_review_id UUID;

-- Axial Code Generations Table
-- Tracks each LLM generation batch
CREATE TABLE IF NOT EXISTS axial_code_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_axial_codes JSONB NOT NULL,  -- Array of {code, description, source_open_codes[]}
  source_session_ids TEXT[] NOT NULL,
  source_open_codes TEXT[] NOT NULL,
  model_used TEXT NOT NULL,
  prompt_version TEXT DEFAULT 'v1',
  status TEXT CHECK (status IN ('pending', 'reviewed', 'completed')) DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Axial Code Reviews Table
-- Tracks user decisions on each generated axial code
CREATE TABLE IF NOT EXISTS axial_code_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES axial_code_generations(id) ON DELETE CASCADE,
  original_code TEXT NOT NULL,
  original_description TEXT,
  final_code TEXT,  -- User-modified version (or same as original if approved as-is)
  final_description TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'modified')) DEFAULT 'pending',
  mapped_open_codes TEXT[] NOT NULL,
  mapped_session_ids TEXT[] DEFAULT '{}',
  category_id UUID REFERENCES evaluation_categories(id),  -- Set when promoted to category
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key from evaluation_categories back to axial_code_reviews
ALTER TABLE evaluation_categories 
ADD CONSTRAINT fk_axial_review_id 
FOREIGN KEY (axial_review_id) REFERENCES axial_code_reviews(id) ON DELETE SET NULL;

-- Indexes for axial coding tables
CREATE INDEX IF NOT EXISTS idx_axial_generations_status ON axial_code_generations(status);
CREATE INDEX IF NOT EXISTS idx_axial_generations_created_at ON axial_code_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_axial_reviews_generation_id ON axial_code_reviews(generation_id);
CREATE INDEX IF NOT EXISTS idx_axial_reviews_status ON axial_code_reviews(status);
CREATE INDEX IF NOT EXISTS idx_axial_reviews_category_id ON axial_code_reviews(category_id);

-- RLS for axial coding tables
ALTER TABLE axial_code_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE axial_code_reviews ENABLE ROW LEVEL SECURITY;

-- Admin only access for axial code tables
CREATE POLICY "Admins can manage axial code generations"
  ON axial_code_generations
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can manage axial code reviews"
  ON axial_code_reviews
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Grant permissions
GRANT ALL ON axial_code_generations TO authenticated;
GRANT ALL ON axial_code_reviews TO authenticated;

-- ============================================================================
-- Error Diagnosis Tables
-- For AI-powered root cause analysis and auto-fix recommendations
-- ============================================================================

-- Error Diagnoses Table
-- Tracks AI diagnoses for each admin-confirmed error
CREATE TABLE IF NOT EXISTS error_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  evaluation_id UUID REFERENCES chat_evaluations(id) ON DELETE CASCADE,
  
  -- Diagnosis results
  root_cause TEXT NOT NULL,
  error_type TEXT CHECK (error_type IN ('prompt', 'code', 'both', 'unknown')) NOT NULL,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  diagnosis_details JSONB DEFAULT '{}',
  
  -- Recommendations
  recommendations JSONB NOT NULL, -- Array of {type, description, changes, can_auto_apply}
  status TEXT CHECK (status IN ('pending', 'reviewed', 'approved', 'applied', 'rejected')) DEFAULT 'pending',
  
  -- Application tracking
  applied_changes JSONB, -- Tracks what was actually applied
  application_method TEXT CHECK (application_method IN ('auto', 'manual', 'partial')),
  application_instructions TEXT, -- For manual application
  
  -- Audit trail
  diagnosed_by UUID REFERENCES auth.users(id), -- Admin who triggered
  reviewed_by UUID REFERENCES auth.users(id),
  applied_by UUID REFERENCES auth.users(id),
  diagnosed_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  
  -- Model info
  model_used TEXT NOT NULL,
  prompt_version TEXT DEFAULT 'v1'
);

-- Fix Applications Table
-- Tracks applied fixes for audit trail
CREATE TABLE IF NOT EXISTS fix_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID REFERENCES error_diagnoses(id) ON DELETE CASCADE,
  
  -- What was changed
  change_type TEXT CHECK (change_type IN ('prompt', 'code_file', 'config')) NOT NULL,
  target_identifier TEXT NOT NULL, -- prompt key, file path, etc.
  old_value TEXT,
  new_value TEXT,
  
  -- Application details
  application_method TEXT CHECK (application_method IN ('auto', 'manual')) NOT NULL,
  applied_by UUID REFERENCES auth.users(id),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Verification
  verification_status TEXT CHECK (verification_status IN ('pending', 'verified', 'failed')) DEFAULT 'pending',
  verification_notes TEXT
);

-- Indexes for error diagnoses
CREATE INDEX IF NOT EXISTS idx_error_diagnoses_session_id ON error_diagnoses(session_id);
CREATE INDEX IF NOT EXISTS idx_error_diagnoses_evaluation_id ON error_diagnoses(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_error_diagnoses_status ON error_diagnoses(status);
CREATE INDEX IF NOT EXISTS idx_error_diagnoses_error_type ON error_diagnoses(error_type);
CREATE INDEX IF NOT EXISTS idx_error_diagnoses_diagnosed_at ON error_diagnoses(diagnosed_at DESC);

-- Indexes for fix applications
CREATE INDEX IF NOT EXISTS idx_fix_applications_diagnosis_id ON fix_applications(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_fix_applications_change_type ON fix_applications(change_type);
CREATE INDEX IF NOT EXISTS idx_fix_applications_verification_status ON fix_applications(verification_status);

-- RLS for error diagnosis tables
ALTER TABLE error_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_applications ENABLE ROW LEVEL SECURITY;

-- Admin only access for error diagnosis tables
CREATE POLICY "Admins can manage error diagnoses"
  ON error_diagnoses
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can manage fix applications"
  ON fix_applications
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Grant permissions
GRANT ALL ON error_diagnoses TO authenticated;
GRANT ALL ON fix_applications TO authenticated;
