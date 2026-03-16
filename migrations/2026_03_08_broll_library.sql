-- Shared B-roll library: captures of website routes reused across video drafts.
-- Used by: broll-library API routes, video generation pipeline.

CREATE TABLE IF NOT EXISTS broll_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL,
  route_description TEXT,
  filename TEXT NOT NULL,
  screenshot_path TEXT,
  clip_path TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(route, filename)
);

CREATE INDEX IF NOT EXISTS idx_broll_library_route ON broll_library(route);
CREATE INDEX IF NOT EXISTS idx_broll_library_filename ON broll_library(filename);

ALTER TABLE broll_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage broll_library" ON broll_library;
CREATE POLICY "Admins can manage broll_library"
  ON broll_library FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
