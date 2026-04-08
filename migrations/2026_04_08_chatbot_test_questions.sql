-- Chatbot Test Questions — custom questions created by admins via the UI.
-- Built-in questions live in lib/testing/chatbot-questions.ts; this table
-- stores admin-created additions so they can be managed without code changes.

CREATE TABLE IF NOT EXISTS chatbot_test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  expected_keywords TEXT[] DEFAULT '{}',
  expects_boundary BOOLEAN DEFAULT FALSE,
  triggers_diagnostic BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_chatbot_test_questions_category
  ON chatbot_test_questions(category);

-- RLS: admin-only via service role (API uses supabaseAdmin)
ALTER TABLE chatbot_test_questions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes use supabaseAdmin)
CREATE POLICY "Service role full access" ON chatbot_test_questions
  FOR ALL
  USING (true)
  WITH CHECK (true);
