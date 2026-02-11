-- Create analytics_sessions table (referenced by POST /api/analytics, GET /api/analytics/stats, export, cleanup)
-- Fixes PGRST205: "Could not find the table 'public.analytics_sessions' in the schema cache"

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  page_views INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_session_id ON analytics_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started_at ON analytics_sessions(started_at DESC);

-- RLS
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert analytics sessions" ON analytics_sessions;
CREATE POLICY "Anyone can insert analytics sessions"
  ON analytics_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update analytics sessions" ON analytics_sessions;
CREATE POLICY "Anyone can update analytics sessions"
  ON analytics_sessions FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view analytics sessions" ON analytics_sessions;
CREATE POLICY "Admins can view analytics sessions"
  ON analytics_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE analytics_sessions IS 'Tracks analytics sessions (page_views, referrer, etc.) per session_id';
