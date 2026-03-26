-- ============================================================================
-- Migration: Merge overlapping pain point categories
-- Date: 2026-03-26
-- Purpose:
--   1. Merge manual_data_entry INTO no_automation (rename to manual_processes)
--   2. Merge scattered_data INTO scattered_tools (update display name)
--
-- Rationale: "Manual data entry" is a symptom of "no automation" — they are
-- not mutually exclusive. "Scattered data" is a consequence of "scattered
-- tools." Merging makes the taxonomy cleaner for classification, pricing,
-- and reporting.
-- ============================================================================

-- ============================================================================
-- 1. MERGE: manual_data_entry → no_automation (survivor)
-- ============================================================================

-- 1a. Reassign pain_point_evidence rows
UPDATE pain_point_evidence
SET pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'no_automation')
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'manual_data_entry');

-- 1b. Reassign value_calculations rows
UPDATE value_calculations
SET pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'no_automation')
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'manual_data_entry');

-- 1c. Reassign content_pain_point_map rows (skip duplicates)
UPDATE content_pain_point_map
SET pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'no_automation')
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'manual_data_entry')
  AND NOT EXISTS (
    SELECT 1 FROM content_pain_point_map cpm2
    WHERE cpm2.content_type = content_pain_point_map.content_type
      AND cpm2.content_id = content_pain_point_map.content_id
      AND cpm2.pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'no_automation')
  );

-- Delete remaining duplicates that couldn't be reassigned
DELETE FROM content_pain_point_map
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'manual_data_entry');

-- 1d. Reassign acceleration_recommendations rows
UPDATE acceleration_recommendations
SET pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'no_automation')
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'manual_data_entry');

-- 1e. Rename the survivor and absorb frequency_count
UPDATE pain_point_categories
SET
  name = 'manual_processes',
  display_name = 'Manual & Unautomated Processes',
  description = 'Time spent on repetitive manual tasks — data entry, manual workflows, and processes that could be automated',
  frequency_count = frequency_count + (SELECT frequency_count FROM pain_point_categories WHERE name = 'manual_data_entry'),
  related_services = (
    SELECT array_agg(DISTINCT s)
    FROM (
      SELECT unnest(related_services) AS s FROM pain_point_categories WHERE name IN ('no_automation', 'manual_data_entry')
    ) sub
  ),
  industry_tags = (
    SELECT array_agg(DISTINCT t)
    FROM (
      SELECT unnest(industry_tags) AS t FROM pain_point_categories WHERE name IN ('no_automation', 'manual_data_entry')
    ) sub
  ),
  updated_at = NOW()
WHERE name = 'no_automation';

-- 1f. Deactivate absorbed category
UPDATE pain_point_categories
SET is_active = false, updated_at = NOW()
WHERE name = 'manual_data_entry';


-- ============================================================================
-- 2. MERGE: scattered_data → scattered_tools (survivor)
-- ============================================================================

-- 2a. Reassign pain_point_evidence rows
UPDATE pain_point_evidence
SET pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_tools')
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_data');

-- 2b. Reassign value_calculations rows
UPDATE value_calculations
SET pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_tools')
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_data');

-- 2c. Reassign content_pain_point_map rows (skip duplicates)
UPDATE content_pain_point_map
SET pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_tools')
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_data')
  AND NOT EXISTS (
    SELECT 1 FROM content_pain_point_map cpm2
    WHERE cpm2.content_type = content_pain_point_map.content_type
      AND cpm2.content_id = content_pain_point_map.content_id
      AND cpm2.pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_tools')
  );

-- Delete remaining duplicates
DELETE FROM content_pain_point_map
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_data');

-- 2d. Reassign acceleration_recommendations rows
UPDATE acceleration_recommendations
SET pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_tools')
WHERE pain_point_category_id = (SELECT id FROM pain_point_categories WHERE name = 'scattered_data');

-- 2e. Update survivor display name and absorb frequency_count
UPDATE pain_point_categories
SET
  display_name = 'Scattered Tools & Data',
  description = 'Using multiple disconnected tools and fragmented data leading to lost context, double-work, and inability to find information',
  frequency_count = frequency_count + (SELECT frequency_count FROM pain_point_categories WHERE name = 'scattered_data'),
  industry_tags = (
    SELECT array_agg(DISTINCT t)
    FROM (
      SELECT unnest(industry_tags) AS t FROM pain_point_categories WHERE name IN ('scattered_tools', 'scattered_data')
    ) sub
  ),
  updated_at = NOW()
WHERE name = 'scattered_tools';

-- 2f. Deactivate absorbed category
UPDATE pain_point_categories
SET is_active = false, updated_at = NOW()
WHERE name = 'scattered_data';
