-- Chatbot Template Database Schema
-- Run this in your Supabase SQL editor

-- ============================================================================
-- Chat Sessions and Messages
-- ============================================================================

-- Chat sessions table to track conversations
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  visitor_email TEXT,
  visitor_name TEXT,
  is_escalated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table to store conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'support')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- System Prompts (Optional - for dynamic prompt management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_system_prompts_key ON system_prompts(key);

-- ============================================================================
-- Update Triggers
-- ============================================================================

-- Update trigger for chat_sessions.updated_at
CREATE OR REPLACE FUNCTION update_chat_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_session_updated_at ON chat_sessions;
CREATE TRIGGER trigger_update_chat_session_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_updated_at();

-- Update trigger for system_prompts.updated_at
CREATE OR REPLACE FUNCTION update_system_prompt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_system_prompt_updated_at ON system_prompts;
CREATE TRIGGER trigger_update_system_prompt_updated_at
  BEFORE UPDATE ON system_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_system_prompt_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to create and read chat sessions
CREATE POLICY "Anyone can create chat sessions"
  ON chat_sessions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read chat sessions"
  ON chat_sessions FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update chat sessions"
  ON chat_sessions FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Allow anyone to create and read chat messages
CREATE POLICY "Anyone can create chat messages"
  ON chat_messages FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read chat messages"
  ON chat_messages FOR SELECT TO anon, authenticated
  USING (true);

-- System prompts are readable by service role only (configured in lib/supabase.ts)
CREATE POLICY "Service role can manage system prompts"
  ON system_prompts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT ALL ON chat_sessions TO anon, authenticated;
GRANT ALL ON chat_messages TO anon, authenticated;
GRANT SELECT ON system_prompts TO authenticated;
