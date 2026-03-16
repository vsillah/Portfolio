-- Time tracking entries for client projects
-- Supports both milestone-level and task-level time tracking
-- with a start/stop timer pattern (is_running flag)

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('milestone', 'task')),
  target_id TEXT NOT NULL,
  description TEXT,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  is_running BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(client_project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_target ON time_entries(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_running ON time_entries(is_running) WHERE is_running = true;

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to time_entries"
  ON time_entries FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public read time_entries by project"
  ON time_entries FOR SELECT
  USING (true);
