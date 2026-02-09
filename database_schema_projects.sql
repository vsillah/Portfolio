-- Portfolio Projects Table
-- This is for showcase projects (different from client_projects which tracks actual client work)
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  github TEXT, -- GitHub repository URL
  live TEXT, -- Live demo URL
  image TEXT, -- Project thumbnail/screenshot URL
  technologies TEXT[] DEFAULT '{}', -- Array of tech stack items
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  file_path TEXT, -- For uploaded project files
  file_type TEXT,
  file_size INTEGER,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_published ON projects(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_projects_display_order ON projects(display_order);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Public can view published projects" ON projects;
CREATE POLICY "Public can view published projects"
  ON projects FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage projects" ON projects;
CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();
