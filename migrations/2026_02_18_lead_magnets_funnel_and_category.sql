-- ============================================================================
-- Migration: Lead magnets category, funnel_stage, access_type, display_order
-- Date: 2026-02-18
-- Purpose: Add client-facing funnel organization and internal category/access.
-- Apply after: 2026_02_11_lead_magnets_file_path_compat.sql
-- ============================================================================

-- Add columns (nullable first for backfill)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'category') THEN
    ALTER TABLE lead_magnets ADD COLUMN category TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'access_type') THEN
    ALTER TABLE lead_magnets ADD COLUMN access_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'funnel_stage') THEN
    ALTER TABLE lead_magnets ADD COLUMN funnel_stage TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'display_order') THEN
    ALTER TABLE lead_magnets ADD COLUMN display_order INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'private_link_token') THEN
    ALTER TABLE lead_magnets ADD COLUMN private_link_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'slug') THEN
    ALTER TABLE lead_magnets ADD COLUMN slug TEXT;
  END IF;
END $$;

-- Backfill existing rows: gate_keeper, public_gated, attention_capture; display_order by created_at
UPDATE lead_magnets
SET
  category = COALESCE(category, 'gate_keeper'),
  access_type = COALESCE(access_type, 'public_gated'),
  funnel_stage = COALESCE(funnel_stage, 'attention_capture'),
  display_order = COALESCE(display_order, 0);

-- Set display_order sequentially by created_at within funnel_stage (for existing rows)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY funnel_stage ORDER BY created_at, id) - 1 AS rn
  FROM lead_magnets
)
UPDATE lead_magnets lm
SET display_order = ordered.rn
FROM ordered
WHERE lm.id = ordered.id;

-- Add NOT NULL and defaults for new inserts
ALTER TABLE lead_magnets ALTER COLUMN category SET DEFAULT 'gate_keeper';
ALTER TABLE lead_magnets ALTER COLUMN category SET NOT NULL;
ALTER TABLE lead_magnets ALTER COLUMN access_type SET DEFAULT 'public_gated';
ALTER TABLE lead_magnets ALTER COLUMN access_type SET NOT NULL;
ALTER TABLE lead_magnets ALTER COLUMN funnel_stage SET DEFAULT 'attention_capture';
ALTER TABLE lead_magnets ALTER COLUMN funnel_stage SET NOT NULL;
ALTER TABLE lead_magnets ALTER COLUMN display_order SET DEFAULT 0;
ALTER TABLE lead_magnets ALTER COLUMN display_order SET NOT NULL;

-- CHECK constraints
ALTER TABLE lead_magnets DROP CONSTRAINT IF EXISTS lead_magnets_category_check;
ALTER TABLE lead_magnets ADD CONSTRAINT lead_magnets_category_check
  CHECK (category IN ('gate_keeper', 'deal_closer', 'retention'));

ALTER TABLE lead_magnets DROP CONSTRAINT IF EXISTS lead_magnets_access_type_check;
ALTER TABLE lead_magnets ADD CONSTRAINT lead_magnets_access_type_check
  CHECK (access_type IN ('public_gated', 'private_link', 'internal', 'client_portal'));

ALTER TABLE lead_magnets DROP CONSTRAINT IF EXISTS lead_magnets_funnel_stage_check;
ALTER TABLE lead_magnets ADD CONSTRAINT lead_magnets_funnel_stage_check
  CHECK (funnel_stage IN (
    'attention_capture',
    'scheduling_show_rate',
    'sales_call_process',
    'close_onboarding',
    'delivery_results',
    'flywheel_reinvestment'
  ));

-- Unique token for private links
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_magnets_private_link_token
  ON lead_magnets(private_link_token)
  WHERE private_link_token IS NOT NULL AND private_link_token != '';

-- Index for Resources page list: filter by category + access_type, order by funnel_stage + display_order
CREATE INDEX IF NOT EXISTS idx_lead_magnets_category_access_funnel_order
  ON lead_magnets(category, access_type, funnel_stage, display_order)
  WHERE is_active = true;
