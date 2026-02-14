-- ============================================================================
-- Migration: Bundle base_bundle_id data backfill
-- Date: 2026-02-15
-- Purpose: Set base_bundle_id and replace bundle_items with delta-only items
--          for Accelerator, Growth Engine, Digital Transformation.
-- Dependencies: 2026_02_15_base_bundle_id.sql (column must exist)
--               services table, offer_bundles table
-- ============================================================================

-- AI Accelerator: base = Quick Win, delta items only
UPDATE offer_bundles
SET
  base_bundle_id = (SELECT id FROM offer_bundles WHERE name = 'AI Quick Win' LIMIT 1),
  bundle_items = (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'content_type', 'service',
        'content_id', s.id::text,
        'display_order', t.ord - 1,
        'is_optional', false,
        'override_role', t.role,
        'override_perceived_value', t.val
      ) ORDER BY t.ord
    ), '[]'::jsonb)
    FROM (
      VALUES
        (1, 'AI Customer Support Chatbot', 'core_offer', 15000),
        (2, 'Inbound Lead Tracking System', 'core_offer', 12000),
        (3, 'Team AI Training — 3-Session Program', 'bonus', 2500),
        (4, '1-on-1 AI Coaching', 'bonus', 3000),
        (5, 'Implementation Warranty', 'bonus', 2000)
    ) AS t(ord, title, role, val)
    JOIN services s ON s.title = t.title
  )
WHERE name = 'AI Accelerator';

-- Growth Engine: base = Accelerator, delta items only
UPDATE offer_bundles
SET
  base_bundle_id = (SELECT id FROM offer_bundles WHERE name = 'AI Accelerator' LIMIT 1),
  bundle_items = (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'content_type', 'service',
        'content_id', s.id::text,
        'display_order', t.ord - 1,
        'is_optional', false,
        'override_role', t.role,
        'override_perceived_value', t.val
      ) ORDER BY t.ord
    ), '[]'::jsonb)
    FROM (
      VALUES
        (1, 'Lead Generation Workflow Agent', 'core_offer', 25000),
        (2, 'Social Media Content Agent', 'core_offer', 18000),
        (3, 'Client Onboarding Automation', 'bonus', 15000),
        (4, 'AI Email Sequence Builder', 'bonus', 10000),
        (5, 'Monthly Advisory Retainer', 'bonus', 7500),
        (6, 'Implementation Warranty', 'bonus', 3000)
    ) AS t(ord, title, role, val)
    JOIN services s ON s.title = t.title
  )
WHERE name = 'Growth Engine';

-- Digital Transformation: base = Growth Engine, delta items only
UPDATE offer_bundles
SET
  base_bundle_id = (SELECT id FROM offer_bundles WHERE name = 'Growth Engine' LIMIT 1),
  bundle_items = (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'content_type', 'service',
        'content_id', s.id::text,
        'display_order', t.ord - 1,
        'is_optional', false,
        'override_role', t.role,
        'override_perceived_value', t.val
      ) ORDER BY t.ord
    ), '[]'::jsonb)
    FROM (
      VALUES
        (1, 'AI Strategy Workshop — Full-Day', 'core_offer', 7500),
        (2, 'AI Voice Agent — Inbound', 'core_offer', 20000),
        (3, 'Mobile App Generation', 'core_offer', 35000),
        (4, 'Website Development', 'core_offer', 20000),
        (5, 'RAG Knowledge Base System', 'bonus', 20000),
        (6, 'Team AI Training — 3-Session Program', 'bonus', 7500),
        (7, 'Implementation Warranty', 'bonus', 9000)
    ) AS t(ord, title, role, val)
    JOIN services s ON s.title = t.title
  )
WHERE name = 'Digital Transformation';
