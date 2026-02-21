-- Migration: Add user_id to chat_sessions for authenticated chat
-- Depends on: chat_sessions table (database_schema_chat.sql)

-- Link chat sessions to authenticated Supabase users
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
