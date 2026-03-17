-- ============================================================================
-- Migration: Storage policies for documents bucket
-- Date: 2026-03-17
-- Purpose: Allow uploads and access for proposal documents (proposal-docs/*).
--          Bucket may already exist; this adds policies only.
-- Apply in Supabase SQL Editor or via MCP if storage schema is in scope.
-- ============================================================================

-- Service role full access: API routes use supabaseAdmin to upload and create signed URLs
DROP POLICY IF EXISTS "Service role full access for documents" ON storage.objects;
CREATE POLICY "Service role full access for documents" ON storage.objects
    FOR ALL
    USING (bucket_id = 'documents' AND auth.role() = 'service_role')
    WITH CHECK (bucket_id = 'documents' AND auth.role() = 'service_role');

-- Authenticated admins can upload (e.g. if uploads ever use user token from admin UI)
DROP POLICY IF EXISTS "Admins can upload to documents" ON storage.objects;
CREATE POLICY "Admins can upload to documents"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Authenticated admins can read/update/delete (list and delete in admin UI)
DROP POLICY IF EXISTS "Admins can manage documents" ON storage.objects;
CREATE POLICY "Admins can manage documents"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'documents'
        AND EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        bucket_id = 'documents'
        AND EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
