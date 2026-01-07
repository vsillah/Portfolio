# Authentication and Admin System - Database Setup

## Step 1: Run this SQL in Supabase SQL Editor

```sql
-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Lead Magnets Table
CREATE TABLE IF NOT EXISTS lead_magnets (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Download Tracking Table
CREATE TABLE IF NOT EXISTS lead_magnet_downloads (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  lead_magnet_id BIGINT NOT NULL REFERENCES lead_magnets(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_downloads_user ON lead_magnet_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_magnet ON lead_magnet_downloads(lead_magnet_id);
CREATE INDEX IF NOT EXISTS idx_downloads_date ON lead_magnet_downloads(downloaded_at DESC);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_magnets_updated_at
  BEFORE UPDATE ON lead_magnets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_magnet_downloads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for lead_magnets
CREATE POLICY "Anyone can view active lead magnets"
  ON lead_magnets FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage lead magnets"
  ON lead_magnets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for lead_magnet_downloads
CREATE POLICY "Users can view their own downloads"
  ON lead_magnet_downloads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own downloads"
  ON lead_magnet_downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all downloads"
  ON lead_magnet_downloads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## Step 2: Create Supabase Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `lead-magnets`
3. Set it to **Private** (not public)
4. Add policy: "Authenticated users can read files"
5. Add policy: "Admins can upload/manage files"

Storage Policy SQL:
```sql
-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read lead magnets"
ON storage.objects FOR SELECT
USING (bucket_id = 'lead-magnets' AND auth.role() = 'authenticated');

-- Allow admins to upload files
CREATE POLICY "Admins can upload lead magnets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lead-magnets' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update/delete files
CREATE POLICY "Admins can manage lead magnets"
ON storage.objects FOR ALL
USING (
  bucket_id = 'lead-magnets' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

## Step 3: Content Management Tables (Optional - for future use)

If you want to store content in the database instead of hardcoding:

```sql
-- Projects table (if moving from hardcoded to database)
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  github TEXT,
  live TEXT,
  image TEXT,
  technologies TEXT[],
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Similar tables for videos, publications, music...
```

## Step 4: Promote First Admin User

After creating your account, run this SQL to make yourself an admin:

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```
