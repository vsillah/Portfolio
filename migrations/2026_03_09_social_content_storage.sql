-- ========================================
-- Social Content Storage Bucket
-- ========================================
-- Purpose: Supabase Storage bucket for generated images and audio files
-- Created: 2026-03-09

-- Create the storage bucket (run in Supabase Dashboard > Storage if this fails via SQL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'social-content',
    'social-content',
    true,
    10485760, -- 10MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/wav', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for social content" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'social-content');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload for social content" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'social-content' AND auth.role() = 'authenticated');

-- Allow service role full access (for n8n uploads)
CREATE POLICY "Service role full access for social content" ON storage.objects
    FOR ALL
    USING (bucket_id = 'social-content')
    WITH CHECK (bucket_id = 'social-content');
