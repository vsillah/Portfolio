-- ============================================================================
-- Offer Bundles Schema Update
-- Adds polymorphic content support, parent tracking, and non-destructive overrides
-- ============================================================================

-- Add new columns to offer_bundles table
ALTER TABLE offer_bundles 
  ADD COLUMN IF NOT EXISTS parent_bundle_id UUID REFERENCES offer_bundles(id),
  ADD COLUMN IF NOT EXISTS bundle_type TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS default_discount_percent DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for lineage queries (fork tracking)
CREATE INDEX IF NOT EXISTS idx_offer_bundles_parent ON offer_bundles(parent_bundle_id);

-- ============================================================================
-- Bundle Items Structure Documentation
-- ============================================================================
-- The bundle_items JSONB column stores items with override fields.
-- Overrides take precedence over the canonical content_offer_roles values.
-- Original content classification is NEVER modified by bundle overrides.
--
-- Example bundle_items structure:
-- [
--   {
--     "content_type": "product",        -- ContentType enum value
--     "content_id": "uuid-here",        -- References the actual content
--     "display_order": 1,               -- Order within the bundle
--     "is_optional": false,             -- Can be removed during sales call
--     
--     -- Override fields (take precedence over content_offer_roles)
--     "override_role": "core_offer",    -- Overrides offer_role from content_offer_roles
--     "override_price": 75.00,          -- Overrides retail_price
--     "override_perceived_value": 200.00,
--     "override_dream_outcome": "Custom outcome description for this bundle",
--     "override_bonus_name": null,
--     "override_bonus_goal_relation": null,
--     "override_likelihood": null,      -- 1-10 scale
--     "override_time_reduction": null,  -- Days saved
--     "override_effort_reduction": null -- 1-10 scale
--   }
-- ]

-- ============================================================================
-- Helper View: Bundles with resolved item counts
-- ============================================================================
CREATE OR REPLACE VIEW bundles_with_stats AS
SELECT 
  b.*,
  jsonb_array_length(b.bundle_items) as item_count,
  (SELECT name FROM offer_bundles WHERE id = b.parent_bundle_id) as parent_name,
  (SELECT COUNT(*) FROM offer_bundles WHERE parent_bundle_id = b.id) as fork_count
FROM offer_bundles b;

-- ============================================================================
-- Function: Resolve bundle items with canonical values + overrides
-- ============================================================================
CREATE OR REPLACE FUNCTION resolve_bundle_items(p_bundle_id UUID)
RETURNS TABLE (
  content_type TEXT,
  content_id TEXT,
  display_order INTEGER,
  is_optional BOOLEAN,
  title TEXT,
  description TEXT,
  image_url TEXT,
  -- Resolved values (override or canonical)
  offer_role TEXT,
  retail_price DECIMAL(10,2),
  perceived_value DECIMAL(10,2),
  dream_outcome TEXT,
  bonus_name TEXT,
  likelihood_multiplier DECIMAL(3,1),
  time_reduction INTEGER,
  effort_reduction DECIMAL(3,1),
  -- Indicator
  has_overrides BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH bundle_data AS (
    SELECT 
      jsonb_array_elements(bundle_items) as item
    FROM offer_bundles 
    WHERE id = p_bundle_id
  ),
  items AS (
    SELECT
      (item->>'content_type')::TEXT as content_type,
      (item->>'content_id')::TEXT as content_id,
      COALESCE((item->>'display_order')::INTEGER, 0) as display_order,
      COALESCE((item->>'is_optional')::BOOLEAN, false) as is_optional,
      item->>'override_role' as override_role,
      (item->>'override_price')::DECIMAL(10,2) as override_price,
      (item->>'override_perceived_value')::DECIMAL(10,2) as override_perceived_value,
      item->>'override_dream_outcome' as override_dream_outcome,
      item->>'override_bonus_name' as override_bonus_name,
      (item->>'override_likelihood')::DECIMAL(3,1) as override_likelihood,
      (item->>'override_time_reduction')::INTEGER as override_time_reduction,
      (item->>'override_effort_reduction')::DECIMAL(3,1) as override_effort_reduction
    FROM bundle_data
  )
  SELECT
    i.content_type,
    i.content_id,
    i.display_order,
    i.is_optional,
    -- Title from content source (varies by content_type)
    CASE i.content_type
      WHEN 'product' THEN (SELECT p.title FROM products p WHERE p.id::TEXT = i.content_id)
      WHEN 'project' THEN (SELECT pr.title FROM projects pr WHERE pr.id::TEXT = i.content_id)
      WHEN 'video' THEN (SELECT v.title FROM videos v WHERE v.id::TEXT = i.content_id)
      WHEN 'publication' THEN (SELECT pub.title FROM publications pub WHERE pub.id::TEXT = i.content_id)
      WHEN 'music' THEN (SELECT m.title FROM music m WHERE m.id::TEXT = i.content_id)
      WHEN 'lead_magnet' THEN (SELECT lm.title FROM lead_magnets lm WHERE lm.id::TEXT = i.content_id)
      WHEN 'prototype' THEN (SELECT pt.title FROM prototypes pt WHERE pt.id::TEXT = i.content_id)
      ELSE 'Unknown'
    END as title,
    -- Description
    CASE i.content_type
      WHEN 'product' THEN (SELECT p.description FROM products p WHERE p.id::TEXT = i.content_id)
      WHEN 'project' THEN (SELECT pr.description FROM projects pr WHERE pr.id::TEXT = i.content_id)
      ELSE NULL
    END as description,
    -- Image URL
    CASE i.content_type
      WHEN 'product' THEN (SELECT p.image_url FROM products p WHERE p.id::TEXT = i.content_id)
      WHEN 'video' THEN (SELECT v.thumbnail_url FROM videos v WHERE v.id::TEXT = i.content_id)
      ELSE NULL
    END as image_url,
    -- Resolved offer_role (override takes precedence)
    COALESCE(
      i.override_role,
      (SELECT cor.offer_role FROM content_offer_roles cor 
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as offer_role,
    -- Resolved retail_price
    COALESCE(
      i.override_price,
      (SELECT cor.retail_price FROM content_offer_roles cor 
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as retail_price,
    -- Resolved perceived_value
    COALESCE(
      i.override_perceived_value,
      (SELECT cor.perceived_value FROM content_offer_roles cor 
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as perceived_value,
    -- Resolved dream_outcome
    COALESCE(
      i.override_dream_outcome,
      (SELECT cor.dream_outcome_description FROM content_offer_roles cor 
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as dream_outcome,
    -- Resolved bonus_name
    COALESCE(
      i.override_bonus_name,
      (SELECT cor.bonus_name FROM content_offer_roles cor 
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as bonus_name,
    -- Resolved likelihood
    COALESCE(
      i.override_likelihood,
      (SELECT cor.likelihood_multiplier FROM content_offer_roles cor 
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as likelihood_multiplier,
    -- Resolved time_reduction
    COALESCE(
      i.override_time_reduction,
      (SELECT cor.time_reduction FROM content_offer_roles cor 
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as time_reduction,
    -- Resolved effort_reduction
    COALESCE(
      i.override_effort_reduction,
      (SELECT cor.effort_reduction FROM content_offer_roles cor 
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as effort_reduction,
    -- Has overrides indicator
    (i.override_role IS NOT NULL OR 
     i.override_price IS NOT NULL OR 
     i.override_perceived_value IS NOT NULL OR
     i.override_dream_outcome IS NOT NULL) as has_overrides
  FROM items i
  ORDER BY i.display_order;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: Update timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_offer_bundles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_offer_bundles_updated_at ON offer_bundles;
CREATE TRIGGER trigger_offer_bundles_updated_at
  BEFORE UPDATE ON offer_bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_bundles_updated_at();

-- ============================================================================
-- RLS Policies for offer_bundles (if not already created)
-- ============================================================================
-- Note: Policies may already exist from database_schema_sales.sql
-- These are safe to run multiple times due to IF NOT EXISTS pattern

DROP POLICY IF EXISTS "Admins can manage offer bundles" ON offer_bundles;
CREATE POLICY "Admins can manage offer bundles"
  ON offer_bundles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can view active bundles" ON offer_bundles;
CREATE POLICY "Public can view active bundles"
  ON offer_bundles FOR SELECT
  USING (is_active = true);
