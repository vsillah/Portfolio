# Analytics Dashboard Setup Guide

## Step 1: Create Database Tables in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Analytics Events Table
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  section TEXT,
  metadata JSONB,
  user_agent TEXT,
  referrer TEXT,
  ip_address TEXT,
  session_id TEXT,
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_section ON analytics_events(section);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);

-- Sessions Table
CREATE TABLE analytics_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  page_views INTEGER DEFAULT 0,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_sessions_session_id ON analytics_sessions(session_id);
CREATE INDEX idx_analytics_sessions_started_at ON analytics_sessions(started_at DESC);

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;

-- Allow inserts (for tracking)
CREATE POLICY "Allow public inserts on analytics_events" ON analytics_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public inserts on analytics_sessions" ON analytics_sessions
  FOR INSERT TO anon WITH CHECK (true);
```

## Step 2: Access the Dashboard

Once the tables are created, visit:
- **Local:** http://localhost:3001/admin
- **Production:** https://your-domain.vercel.app/admin

## What's Being Tracked

✅ Page views
✅ Section views (Hero, Projects, Publications, Music, Videos, About, Contact)
✅ Project clicks (GitHub and Live links)
✅ Video plays
✅ Social link clicks (LinkedIn, Email, Spotify, GitHub, Medium)
✅ Contact form views and submissions
✅ Navigation clicks
✅ Device/browser information (anonymized)
✅ Session tracking

## Privacy Features

- IP addresses are anonymized (last octet removed)
- No personal data collected
- Anonymous user IDs (stored in localStorage)
- Session IDs (stored in sessionStorage)

## Next Steps

1. Run the SQL above in Supabase
2. Test the tracking by visiting your site and interacting with components
3. View analytics at `/admin`
4. (Optional) Add authentication to protect the admin dashboard
