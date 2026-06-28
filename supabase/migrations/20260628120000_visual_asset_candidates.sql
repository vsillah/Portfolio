-- Portfolio Visual Curator: human-reviewed homepage image candidates.
-- Audit and capture write candidate rows only. Public image fields change only
-- after an admin approves a candidate and runs apply-approved.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS image_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.app_prototypes
  ADD COLUMN IF NOT EXISTS thumbnail_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.visual_asset_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('product', 'service', 'prototype')),
  entity_id text NOT NULL,
  title text NOT NULL,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  current_url text,
  candidate_url text,
  candidate_storage_path text,
  capture_route text NOT NULL,
  score integer CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'applied', 'failed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  applied_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visual_asset_candidates_entity
  ON public.visual_asset_candidates (entity_type, entity_id, theme);

CREATE INDEX IF NOT EXISTS idx_visual_asset_candidates_status
  ON public.visual_asset_candidates (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_visual_asset_candidates_open_unique
  ON public.visual_asset_candidates (entity_type, entity_id, theme)
  WHERE status IN ('proposed', 'approved');

CREATE OR REPLACE FUNCTION public.set_visual_asset_candidates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visual_asset_candidates_updated_at ON public.visual_asset_candidates;
CREATE TRIGGER trg_visual_asset_candidates_updated_at
  BEFORE UPDATE ON public.visual_asset_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_visual_asset_candidates_updated_at();

ALTER TABLE public.visual_asset_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage visual asset candidates" ON public.visual_asset_candidates;
CREATE POLICY "Admins can manage visual asset candidates"
  ON public.visual_asset_candidates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_asset_candidates TO service_role;
