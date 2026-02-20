-- ============================================================================
-- Migration: Outcome groups for pricing chart (products, services, lead magnets)
-- Date: 2026-02-20
-- Purpose: Allow content to be grouped by outcome (e.g. Capture & convert leads,
--          Save time & scale ops). Outcome groups are managed in the content
--          dashboard; default groups are seeded in the UI, not here.
-- ============================================================================

-- 1. Outcome groups lookup table (create/modify in content dashboard)
CREATE TABLE IF NOT EXISTS outcome_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE outcome_groups IS 'Pricing chart outcome categories (e.g. Capture & convert leads). Managed in Admin → Content → Outcome Groups.';

CREATE INDEX IF NOT EXISTS idx_outcome_groups_display_order ON outcome_groups(display_order);

ALTER TABLE outcome_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage outcome groups" ON outcome_groups;
CREATE POLICY "Admins can manage outcome groups"
  ON outcome_groups FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Public read so pricing/tiers can resolve labels (no sensitive data)
DROP POLICY IF EXISTS "Public can read outcome groups" ON outcome_groups;
CREATE POLICY "Public can read outcome groups"
  ON outcome_groups FOR SELECT
  USING (true);

-- 2. Products: optional outcome group
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'outcome_group_id'
  ) THEN
    ALTER TABLE products ADD COLUMN outcome_group_id UUID REFERENCES outcome_groups(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_products_outcome_group_id ON products(outcome_group_id) WHERE outcome_group_id IS NOT NULL;

-- 3. Services: optional outcome group (includes training)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'outcome_group_id'
  ) THEN
    ALTER TABLE services ADD COLUMN outcome_group_id UUID REFERENCES outcome_groups(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_services_outcome_group_id ON services(outcome_group_id) WHERE outcome_group_id IS NOT NULL;

-- 4. Lead magnets: optional outcome group
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'outcome_group_id'
  ) THEN
    ALTER TABLE lead_magnets ADD COLUMN outcome_group_id UUID REFERENCES outcome_groups(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_lead_magnets_outcome_group_id ON lead_magnets(outcome_group_id) WHERE outcome_group_id IS NOT NULL;
