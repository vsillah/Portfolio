-- ============================================================================
-- Supabase security advisor (WARN):
-- 0011 function_search_path_mutable: set fixed search_path on public functions
-- 0024 rls_policy_always_true: replace USING(true) service policies with role checks
-- ============================================================================
-- Note: auth_leaked_password_protection is a Dashboard (Auth) setting, not SQL.
-- Function ALTERs are guarded (to_regprocedure) so production can lag migrations
-- that create those functions.

-- ---------------------------------------------------------------------------
-- 0011: function search path (idempotent; skip if function not present)
-- ---------------------------------------------------------------------------
DO $migration$
BEGIN
  IF to_regprocedure('public.refresh_pain_point_stats(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.refresh_pain_point_stats(uuid) SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.set_test_data_flag(text,bigint,boolean)') IS NOT NULL THEN
    ALTER FUNCTION public.set_test_data_flag(text, bigint, boolean) SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.cleanup_test_data(text)') IS NOT NULL THEN
    ALTER FUNCTION public.cleanup_test_data(text) SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.complete_task_when_outreach_sent()') IS NOT NULL THEN
    ALTER FUNCTION public.complete_task_when_outreach_sent() SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.search_meeting_records(text,timestamptz,timestamptz,integer,integer)') IS NOT NULL THEN
    ALTER FUNCTION public.search_meeting_records(text, timestamptz, timestamptz, integer, integer) SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.update_kickoff_agenda_templates_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_kickoff_agenda_templates_updated_at() SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.update_kickoff_agendas_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_kickoff_agendas_updated_at() SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.update_offboarding_checklists_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_offboarding_checklists_updated_at() SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.update_onboarding_plan_templates_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_onboarding_plan_templates_updated_at() SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.update_onboarding_plans_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_onboarding_plans_updated_at() SET search_path = 'public';
  END IF;
  IF to_regprocedure('public.update_provisioning_items_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_provisioning_items_updated_at() SET search_path = 'public';
  END IF;
END
$migration$;

-- ---------------------------------------------------------------------------
-- 0024: RLS: service_role explicit (same access as before, satisfies linter)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role full access" ON public.chatbot_test_questions;
CREATE POLICY "Service role full access"
  ON public.chatbot_test_questions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on installment_plans" ON public.installment_plans;
CREATE POLICY "Service role full access on installment_plans"
  ON public.installment_plans
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on installment_payments" ON public.installment_payments;
CREATE POLICY "Service role full access on installment_payments"
  ON public.installment_payments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable insert for service role" ON public.social_content_extraction_runs;
CREATE POLICY "Enable insert for service role"
  ON public.social_content_extraction_runs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable update for service role" ON public.social_content_extraction_runs;
CREATE POLICY "Enable update for service role"
  ON public.social_content_extraction_runs
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
