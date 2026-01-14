-- Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  file_path TEXT, -- for uploaded video files or documents
  file_type TEXT,
  file_size INTEGER,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Publications Table
CREATE TABLE IF NOT EXISTS publications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  publication_url TEXT, -- external link
  author TEXT,
  publication_date DATE,
  publisher TEXT,
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  file_path TEXT, -- for uploaded PDF/document files
  file_type TEXT,
  file_size INTEGER,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Music Table
CREATE TABLE IF NOT EXISTS music (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  description TEXT,
  spotify_url TEXT,
  apple_music_url TEXT,
  youtube_url TEXT,
  release_date DATE,
  genre TEXT,
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  file_path TEXT, -- for uploaded audio files or album artwork
  file_type TEXT,
  file_size INTEGER,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Videos
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_videos_display_order ON videos(display_order);
CREATE INDEX IF NOT EXISTS idx_videos_created_by ON videos(created_by);

-- Indexes for Publications
CREATE INDEX IF NOT EXISTS idx_publications_published ON publications(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_publications_display_order ON publications(display_order);
CREATE INDEX IF NOT EXISTS idx_publications_created_by ON publications(created_by);
CREATE INDEX IF NOT EXISTS idx_publications_date ON publications(publication_date DESC);

-- Indexes for Music
CREATE INDEX IF NOT EXISTS idx_music_published ON music(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_music_display_order ON music(display_order);
CREATE INDEX IF NOT EXISTS idx_music_created_by ON music(created_by);
CREATE INDEX IF NOT EXISTS idx_music_artist ON music(artist);
CREATE INDEX IF NOT EXISTS idx_music_release_date ON music(release_date DESC);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE music ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Videos
DROP POLICY IF EXISTS "Public can view published videos" ON videos;
CREATE POLICY "Public can view published videos"
  ON videos FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage videos" ON videos;
CREATE POLICY "Admins can manage videos"
  ON videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for Publications
DROP POLICY IF EXISTS "Public can view published publications" ON publications;
CREATE POLICY "Public can view published publications"
  ON publications FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage publications" ON publications;
CREATE POLICY "Admins can manage publications"
  ON publications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for Music
DROP POLICY IF EXISTS "Public can view published music" ON music;
CREATE POLICY "Public can view published music"
  ON music FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage music" ON music;
CREATE POLICY "Admins can manage music"
  ON music FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
