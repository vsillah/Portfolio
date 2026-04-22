-- ============================================================================
-- Supabase security advisors:
-- 0008  rls_enabled_no_policy: admin_gmail_user_credentials
-- 0025  public_bucket_allows_listing: storage.objects for bucket social-content
-- ============================================================================
-- Glossary:
-- * admin_gmail: server routes use supabaseAdmin (service role). Policies make
--   the security model explicit; access matches prior behavior.
-- * social-content: bucket stays public. Broad SELECT on storage.objects
--   allowed unauthenticated listing of all object paths. Public file URLs are
--   still served (public bucket bypasses RLS for read). Service uploads use
--   the service key (bypasses RLS). The authenticated INSERT policy is unchanged.
--   See: https://supabase.com/docs/guides/storage/buckets/fundamentals
-- ----------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1) admin_gmail_user_credentials
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role full access on admin_gmail_user_credentials"
  ON public.admin_gmail_user_credentials;

CREATE POLICY "Service role full access on admin_gmail_user_credentials"
  ON public.admin_gmail_user_credentials
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 2) storage: remove listing-capable broad SELECT; keep authenticated upload
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read access for social content" ON storage.objects;

DROP POLICY IF EXISTS "Service role full access for social content" ON storage.objects;
