-- Diagnostic Template Schema
-- Run this in your Supabase SQL Editor to set up the required tables.

CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'in_progress',
  answers JSONB DEFAULT '{}',
  score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE diagnostic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON diagnostic_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON diagnostic_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON diagnostic_sessions FOR UPDATE
  USING (auth.uid() = user_id);
