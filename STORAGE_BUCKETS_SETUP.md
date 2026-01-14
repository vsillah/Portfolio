# Storage Buckets Setup for Videos, Publications, and Music

## Overview

This guide covers creating separate Supabase Storage buckets for videos, publications, and music content. Each bucket will have its own storage policies for better organization and security.

## Step 1: Create Storage Buckets

Go to Supabase Dashboard → Storage and create three new buckets:

1. **videos** - Set to **Private** (not public)
2. **publications** - Set to **Private** (not public)
3. **music** - Set to **Private** (not public)

All buckets should be private for security, consistent with the `projects` and `lead-magnets` buckets.

## Step 2: Add Storage Policies

Run the following SQL in Supabase SQL Editor to create storage policies for each bucket:

### Videos Bucket Policies

```sql
-- Allow authenticated users to read video files
DROP POLICY IF EXISTS "Authenticated users can read video files" ON storage.objects;
CREATE POLICY "Authenticated users can read video files"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos' AND auth.role() = 'authenticated');

-- Allow admins to upload video files
DROP POLICY IF EXISTS "Admins can upload video files" ON storage.objects;
CREATE POLICY "Admins can upload video files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'videos' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update/delete video files
DROP POLICY IF EXISTS "Admins can manage video files" ON storage.objects;
CREATE POLICY "Admins can manage video files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'videos' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### Publications Bucket Policies

```sql
-- Allow authenticated users to read publication files
DROP POLICY IF EXISTS "Authenticated users can read publication files" ON storage.objects;
CREATE POLICY "Authenticated users can read publication files"
ON storage.objects FOR SELECT
USING (bucket_id = 'publications' AND auth.role() = 'authenticated');

-- Allow admins to upload publication files
DROP POLICY IF EXISTS "Admins can upload publication files" ON storage.objects;
CREATE POLICY "Admins can upload publication files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'publications' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update/delete publication files
DROP POLICY IF EXISTS "Admins can manage publication files" ON storage.objects;
CREATE POLICY "Admins can manage publication files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'publications' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### Music Bucket Policies

```sql
-- Allow authenticated users to read music files
DROP POLICY IF EXISTS "Authenticated users can read music files" ON storage.objects;
CREATE POLICY "Authenticated users can read music files"
ON storage.objects FOR SELECT
USING (bucket_id = 'music' AND auth.role() = 'authenticated');

-- Allow admins to upload music files
DROP POLICY IF EXISTS "Admins can upload music files" ON storage.objects;
CREATE POLICY "Admins can upload music files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'music' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update/delete music files
DROP POLICY IF EXISTS "Admins can manage music files" ON storage.objects;
CREATE POLICY "Admins can manage music files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'music' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

## Step 3: Verify Bucket Configuration

After creating the buckets and running the SQL policies:

1. Verify each bucket is set to **Private**
2. Test upload functionality through the admin interface:
   - `/admin/content/videos` - Upload video files
   - `/admin/content/publications` - Upload publication files (PDFs, documents)
   - `/admin/content/music` - Upload music files or album artwork

## File Organization

Files are organized within each bucket using prefixes:
- **Videos**: `video-${videoId}/${fileName}` or `uploads/${fileName}`
- **Publications**: `publication-${publicationId}/${fileName}` or `uploads/${fileName}`
- **Music**: `music-${musicId}/${fileName}` or `uploads/${fileName}`

This organization allows for easy file management and keeps related files grouped together.

## Notes

- All buckets are **Private** for security - files are only accessible to authenticated users
- Admin users can upload and manage files through the admin interface
- Regular authenticated users can read/view files but cannot upload or delete
- File paths are stored in the database tables (`videos.file_path`, `publications.file_path`, `music.file_path`)
