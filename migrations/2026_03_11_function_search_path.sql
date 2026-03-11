-- ============================================================================
-- Security Advisor: Function Search Path Mutable (lint 0011)
-- Set search_path on all flagged functions so they do not inherit caller's path.
-- Using search_path = 'public' so existing unqualified names in bodies still resolve.
-- ============================================================================

ALTER FUNCTION public.update_chat_session_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_chat_evaluation_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_accel_recs_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_services_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_offer_upsell_paths_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_guarantee_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_chat_escalation_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_continuity_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_progress_update_templates_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_site_settings_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_campaign_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_llm_judge_alignment() SET search_path = 'public';
ALTER FUNCTION public.update_proposals_updated_at() SET search_path = 'public';
ALTER FUNCTION public.get_proposal_summary(uuid) SET search_path = 'public';
ALTER FUNCTION public.update_content_offer_roles_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_contact_submissions_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_user_profiles_updated_at() SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';
ALTER FUNCTION public.update_cold_pipeline_updated_at() SET search_path = 'public';
ALTER FUNCTION public.generate_test_run_id() SET search_path = 'public';
ALTER FUNCTION public.update_client_projects_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.cleanup_old_test_data(integer) SET search_path = 'public';
ALTER FUNCTION public.update_product_variants_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_value_pipeline_updated_at() SET search_path = 'public';
ALTER FUNCTION public.resolve_bundle_items(uuid) SET search_path = 'public';
ALTER FUNCTION public.update_offer_bundles_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_system_prompt_updated_at() SET search_path = 'public';
ALTER FUNCTION public.save_system_prompt_history() SET search_path = 'public';
ALTER FUNCTION public.get_system_prompt(text) SET search_path = 'public';
ALTER FUNCTION public.is_admin_user() SET search_path = 'public';
ALTER FUNCTION public.update_sales_updated_at() SET search_path = 'public';
