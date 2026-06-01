-- Optimize PR #384 content-package admin RLS policies.
-- Supabase advisors recommend wrapping auth helper calls in SELECT so Postgres
-- can evaluate them once per statement instead of once per row.

DROP POLICY IF EXISTS "Admins can manage content_frameworks" ON public.content_frameworks;
CREATE POLICY "Admins can manage content_frameworks"
  ON public.content_frameworks FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage social_idea_intakes" ON public.social_idea_intakes;
CREATE POLICY "Admins can manage social_idea_intakes"
  ON public.social_idea_intakes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage content_packages" ON public.content_packages;
CREATE POLICY "Admins can manage content_packages"
  ON public.content_packages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage content_package_outputs" ON public.content_package_outputs;
CREATE POLICY "Admins can manage content_package_outputs"
  ON public.content_package_outputs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));
