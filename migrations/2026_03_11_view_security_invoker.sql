-- ============================================================================
-- Security Advisor: fix "Security Definer View" errors
-- Set security_invoker = true so views run with caller's permissions and RLS
-- applies. Required for Supabase Security Advisor to clear these findings.
-- ============================================================================

ALTER VIEW IF EXISTS public.test_run_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.test_data_for_cleanup SET (security_invoker = true);
ALTER VIEW IF EXISTS public.pending_remediations SET (security_invoker = true);
ALTER VIEW IF EXISTS public.test_error_analysis SET (security_invoker = true);
ALTER VIEW IF EXISTS public.chat_eval_session_summary SET (security_invoker = true);
