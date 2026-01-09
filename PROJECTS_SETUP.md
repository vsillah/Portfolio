# Projects Management - Database Setup

## Step 1: Create Database Table

Run this SQL in Supabase SQL Editor:

```sql
-- Projects table (create if doesn't exist)
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  github TEXT,
  live TEXT,
  image TEXT,
  technologies TEXT[],
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists (migration)
DO $$
BEGIN
  -- Add display_order if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE projects ADD COLUMN display_order INTEGER DEFAULT 0;
  END IF;
  
  -- Add file upload columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE projects ADD COLUMN file_path TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE projects ADD COLUMN file_type TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE projects ADD COLUMN file_size INTEGER;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_published ON projects(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_projects_display_order ON projects(display_order);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Public can view published projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON projects;

-- Public can view published projects
CREATE POLICY "Public can view published projects"
  ON projects FOR SELECT
  USING (is_published = true);

-- Admins can do everything
CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();
```

## Step 2: Create Supabase Storage Bucket for Project Files

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `projects`
3. Set it to **Private** (not public)
4. Add the following storage policies:

```sql
-- Allow authenticated users to read project files
CREATE POLICY "Authenticated users can read project files"
ON storage.objects FOR SELECT
USING (bucket_id = 'projects' AND auth.role() = 'authenticated');

-- Allow admins to upload project files
CREATE POLICY "Admins can upload project files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'projects' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update/delete project files
CREATE POLICY "Admins can manage project files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'projects' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

## Step 3: Migrate Existing Projects (Optional)

If you want to migrate the hardcoded projects to the database, you can insert them manually or use the admin interface after it's built.
