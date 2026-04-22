-- Supabase security advisor: security_definer_view + rls_disabled_in_public
-- (1) Set security_invoker on public views so they run as the caller (RLS applies).
-- (2) Enable RLS on source validator cache/run tables; server uses service_role, admin UI uses is_admin_user().

-- ---------------------------------------------------------------------------
-- Views: security invoker (idempotent; IF EXISTS for environments missing a view)
-- ---------------------------------------------------------------------------
ALTER VIEW IF EXISTS public.content_value_map SET (security_invoker = true);
ALTER VIEW IF EXISTS public.all_classifiable_content SET (security_invoker = true);
ALTER VIEW IF EXISTS public.qualified_leads SET (security_invoker = true);
ALTER VIEW IF EXISTS public.test_error_analysis SET (security_invoker = true);
ALTER VIEW IF EXISTS public.pending_remediations SET (security_invoker = true);
ALTER VIEW IF EXISTS public.test_run_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.cold_lead_pipeline_metrics SET (security_invoker = true);
ALTER VIEW IF EXISTS public.test_data_for_cleanup SET (security_invoker = true);
ALTER VIEW IF EXISTS public.warm_lead_pipeline_metrics SET (security_invoker = true);
ALTER VIEW IF EXISTS public.outreach_active_sequences SET (security_invoker = true);
ALTER VIEW IF EXISTS public.outreach_drafts_pending SET (security_invoker = true);
ALTER VIEW IF EXISTS public.chat_eval_session_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.products_with_roles SET (security_invoker = true);
ALTER VIEW IF EXISTS public.value_evidence_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.value_calculation_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.content_with_offer_roles SET (security_invoker = true);
ALTER VIEW IF EXISTS public.active_project_milestones SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Tables: RLS (source validator — match pattern from 2026_04_08_rls_public_tables)
-- ---------------------------------------------------------------------------
ALTER TABLE public.source_validation_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on source_validation_cache" ON public.source_validation_cache;
DROP POLICY IF EXISTS "Service role bypass on source_validation_cache" ON public.source_validation_cache;
CREATE POLICY "Admin full access on source_validation_cache"
  ON public.source_validation_cache FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on source_validation_cache"
  ON public.source_validation_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.source_triangulation_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on source_triangulation_cache" ON public.source_triangulation_cache;
DROP POLICY IF EXISTS "Service role bypass on source_triangulation_cache" ON public.source_triangulation_cache;
CREATE POLICY "Admin full access on source_triangulation_cache"
  ON public.source_triangulation_cache FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on source_triangulation_cache"
  ON public.source_triangulation_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.source_validation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on source_validation_runs" ON public.source_validation_runs;
DROP POLICY IF EXISTS "Service role bypass on source_validation_runs" ON public.source_validation_runs;
CREATE POLICY "Admin full access on source_validation_runs"
  ON public.source_validation_runs FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
CREATE POLICY "Service role bypass on source_validation_runs"
  ON public.source_validation_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
