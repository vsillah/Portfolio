-- ============================================================================
-- Migration: Create Supabase Storage bucket `publications`
-- Date: 2026-03-23
-- Purpose: Upload route uses storage.from('publications'). Policies exist in
--   2026_02_26_storage_publications_policies.sql but the bucket was never
--   inserted, which causes StorageApiError "Bucket not found".
-- Apply before relying on /api/publications/upload or signed URLs for paths
--   in this bucket.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'publications',
  'publications',
  false,
  524288000, -- 500MB — ebook + audiobook uploads
  NULL
)
ON CONFLICT (id) DO NOTHING;
