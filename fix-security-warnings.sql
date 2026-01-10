-- ============================================================================
-- Supabase Security Fixes - Function Search Path
-- Run this SQL in your Supabase SQL Editor to fix all function search_path warnings
-- ============================================================================

-- 1. Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$;

-- 2. Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Fix update_projects_updated_at function
CREATE OR REPLACE FUNCTION public.update_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4. Fix track_prototype_stage_change function
CREATE OR REPLACE FUNCTION public.track_prototype_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only track if the stage actually changed
  IF OLD.production_stage IS DISTINCT FROM NEW.production_stage THEN
    INSERT INTO public.prototype_stage_history (
      prototype_id,
      old_stage,
      new_stage,
      changed_at
    )
    VALUES (
      NEW.id,
      OLD.production_stage,
      NEW.production_stage,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Verification Query
-- Run this after the above to verify all functions have search_path set
-- ============================================================================
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN p.proconfig IS NULL THEN 'NOT SET ❌'
    WHEN array_to_string(p.proconfig, ',') LIKE '%search_path%' THEN 'SET ✅'
    ELSE 'NOT SET ❌'
  END as search_path_status,
  array_to_string(p.proconfig, ', ') as config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'handle_new_user',
    'update_updated_at_column', 
    'update_projects_updated_at',
    'track_prototype_stage_change'
  )
ORDER BY p.proname;
