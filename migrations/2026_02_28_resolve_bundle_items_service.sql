-- ============================================================================
-- Migration: Add service branch to resolve_bundle_items()
-- Date: 2026-02-28
-- Purpose: When bundle items have content_type = 'service', resolve title,
--          description, and image_url from the services table.
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
  offer_role TEXT,
  retail_price DECIMAL(10,2),
  perceived_value DECIMAL(10,2),
  dream_outcome TEXT,
  bonus_name TEXT,
  likelihood_multiplier DECIMAL(3,1),
  time_reduction INTEGER,
  effort_reduction DECIMAL(3,1),
  has_overrides BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH bundle_data AS (
    SELECT jsonb_array_elements(bundle_items) as item
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
    CASE i.content_type
      WHEN 'product' THEN (SELECT p.title FROM products p WHERE p.id::TEXT = i.content_id)
      WHEN 'project' THEN (SELECT pr.title FROM projects pr WHERE pr.id::TEXT = i.content_id)
      WHEN 'video' THEN (SELECT v.title FROM videos v WHERE v.id::TEXT = i.content_id)
      WHEN 'publication' THEN (SELECT pub.title FROM publications pub WHERE pub.id::TEXT = i.content_id)
      WHEN 'music' THEN (SELECT m.title FROM music m WHERE m.id::TEXT = i.content_id)
      WHEN 'lead_magnet' THEN (SELECT lm.title FROM lead_magnets lm WHERE lm.id::TEXT = i.content_id)
      WHEN 'prototype' THEN (SELECT pt.title FROM app_prototypes pt WHERE pt.id::TEXT = i.content_id)
      WHEN 'service' THEN (SELECT s.title FROM services s WHERE s.id::TEXT = i.content_id)
      ELSE 'Unknown'
    END as title,
    CASE i.content_type
      WHEN 'product' THEN (SELECT p.description FROM products p WHERE p.id::TEXT = i.content_id)
      WHEN 'project' THEN (SELECT pr.description FROM projects pr WHERE pr.id::TEXT = i.content_id)
      WHEN 'service' THEN (SELECT s.description FROM services s WHERE s.id::TEXT = i.content_id)
      ELSE NULL
    END as description,
    CASE i.content_type
      WHEN 'product' THEN (SELECT p.image_url FROM products p WHERE p.id::TEXT = i.content_id)
      WHEN 'video' THEN (SELECT v.thumbnail_url FROM videos v WHERE v.id::TEXT = i.content_id)
      WHEN 'service' THEN (SELECT s.image_url FROM services s WHERE s.id::TEXT = i.content_id)
      ELSE NULL
    END as image_url,
    COALESCE(
      i.override_role,
      (SELECT cor.offer_role FROM content_offer_roles cor
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as offer_role,
    COALESCE(
      i.override_price,
      (SELECT cor.retail_price FROM content_offer_roles cor
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as retail_price,
    COALESCE(
      i.override_perceived_value,
      (SELECT cor.perceived_value FROM content_offer_roles cor
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as perceived_value,
    COALESCE(
      i.override_dream_outcome,
      (SELECT cor.dream_outcome_description FROM content_offer_roles cor
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as dream_outcome,
    COALESCE(
      i.override_bonus_name,
      (SELECT cor.bonus_name FROM content_offer_roles cor
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as bonus_name,
    COALESCE(
      i.override_likelihood,
      (SELECT cor.likelihood_multiplier FROM content_offer_roles cor
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as likelihood_multiplier,
    COALESCE(
      i.override_time_reduction,
      (SELECT cor.time_reduction FROM content_offer_roles cor
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as time_reduction,
    COALESCE(
      i.override_effort_reduction,
      (SELECT cor.effort_reduction FROM content_offer_roles cor
       WHERE cor.content_type = i.content_type AND cor.content_id = i.content_id)
    ) as effort_reduction,
    (i.override_role IS NOT NULL OR
     i.override_price IS NOT NULL OR
     i.override_perceived_value IS NOT NULL OR
     i.override_dream_outcome IS NOT NULL) as has_overrides
  FROM items i
  ORDER BY i.display_order;
END;
$$ LANGUAGE plpgsql;
