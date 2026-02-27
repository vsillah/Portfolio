-- ============================================================================
-- Migration: Storage policies for publications bucket (direct client upload)
-- Date: 2026-02-26
-- Purpose: Allow admin users to upload to the publications bucket from the
--   browser (direct to Supabase) so large audio files bypass Next.js body limit.
-- Run in Supabase SQL Editor if migrations don't apply to storage schema.
-- ============================================================================

-- Publications bucket: allow authenticated users to read
DROP POLICY IF EXISTS "Authenticated users can read publication files" ON storage.objects;
CREATE POLICY "Authenticated users can read publication files"
ON storage.objects FOR SELECT
USING (bucket_id = 'publications' AND auth.role() = 'authenticated');

-- Publications bucket: allow admins to upload
DROP POLICY IF EXISTS "Admins can upload publication files" ON storage.objects;
CREATE POLICY "Admins can upload publication files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'publications' AND
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Publications bucket: allow admins to update/delete
DROP POLICY IF EXISTS "Admins can manage publication files" ON storage.objects;
CREATE POLICY "Admins can manage publication files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'publications' AND
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
