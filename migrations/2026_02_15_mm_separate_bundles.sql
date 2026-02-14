-- ============================================================================
-- Migration: Mid-Market Separate Bundles
-- Date: 2026-02-15
-- Purpose: Create dedicated Mid-Market bundles (MM Accelerator, MM Growth
--          Engine, MM Digital Transformation) with enterprise add-on services.
--          Remove 'midmarket' from SMB bundles so segments are fully separate.
-- Dependencies: 2026_02_15_base_bundle_id.sql, services table, offer_bundles
-- ============================================================================

-- ============================================================================
-- Step 1: Insert 5 enterprise services (idempotent — skip if exists)
-- ============================================================================

INSERT INTO services (title, service_type, price, is_quote_based, delivery_method, description, duration_hours, duration_description, display_order, is_featured, topics, deliverables)
SELECT 'Enterprise SLA','warranty',0,false,'virtual',
  'Guaranteed response times and uptime commitments for all deployed AI tools. Includes 99.9% uptime SLA, 4-hour critical response, and 24-hour standard response.',
  NULL::INTEGER,'Ongoing (contract term)',20,false,
  '["Uptime SLA","Response Time Guarantees","Escalation Procedures","Incident Reporting"]'::jsonb,
  '["SLA agreement","Uptime monitoring dashboard","Incident response playbook","Monthly SLA reports"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM services WHERE title='Enterprise SLA');

INSERT INTO services (title, service_type, price, is_quote_based, delivery_method, description, duration_hours, duration_description, display_order, is_featured, topics, deliverables)
SELECT 'Priority Support Channel','consulting',2500,false,'virtual',
  'Dedicated Slack or Microsoft Teams channel with your team and ours. 4-hour response during business hours, direct access to engineering.',
  NULL::INTEGER,'Ongoing (monthly)',21,false,
  '["Dedicated Channel Setup","Response SLA","Direct Engineering Access","Issue Triage"]'::jsonb,
  '["Private Slack/Teams channel","4-hour response SLA","Named support contacts","Weekly status updates"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM services WHERE title='Priority Support Channel');

INSERT INTO services (title, service_type, price, is_quote_based, delivery_method, description, duration_hours, duration_description, display_order, is_featured, topics, deliverables)
SELECT 'Data Migration & Onboarding','consulting',5000,false,'hybrid',
  'Full-service data migration from existing systems and structured onboarding for your team.',
  40,'2-4 weeks',22,false,
  '["Data Audit","Migration Planning","ETL Execution","Team Onboarding"]'::jsonb,
  '["Migration plan","Data validation report","Onboarding sessions","Runbook documentation"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM services WHERE title='Data Migration & Onboarding');

INSERT INTO services (title, service_type, price, is_quote_based, delivery_method, description, duration_hours, duration_description, display_order, is_featured, topics, deliverables)
SELECT 'Custom API / ERP Integrations','consulting',7500,false,'hybrid',
  'Connect deployed AI tools to your existing enterprise systems — Salesforce, HubSpot, SAP, NetSuite, or custom APIs.',
  60,'3-6 weeks',23,false,
  '["Integration Architecture","API Development","Data Mapping","Testing & Validation"]'::jsonb,
  '["Integration architecture doc","Deployed connectors","Data sync monitoring","Error handling & retry logic"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM services WHERE title='Custom API / ERP Integrations');

INSERT INTO services (title, service_type, price, is_quote_based, delivery_method, description, duration_hours, duration_description, display_order, is_featured, topics, deliverables)
SELECT 'Custom Reporting & Analytics Dashboard','consulting',5000,false,'hybrid',
  'Tailored dashboards and KPI tracking for your AI tools. Executive summaries, department-level views, and automated reporting.',
  40,'2-4 weeks',24,false,
  '["KPI Definition","Dashboard Design","Data Pipeline","Automated Reports"]'::jsonb,
  '["Custom dashboard","Automated weekly/monthly reports","KPI tracking setup","Executive summary template"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM services WHERE title='Custom Reporting & Analytics Dashboard');

-- ============================================================================
-- Step 2: Remove 'midmarket' from SMB bundles; clear DT (replaced by MM DT)
-- ============================================================================

UPDATE offer_bundles
SET pricing_page_segments = ARRAY['smb']::TEXT[]
WHERE name IN ('AI Accelerator', 'Growth Engine')
  AND 'midmarket' = ANY(pricing_page_segments);

-- Digital Transformation is now the base for MM Digital Transformation;
-- it no longer appears on the pricing page directly.
UPDATE offer_bundles
SET pricing_page_segments = '{}'::TEXT[]
WHERE name = 'Digital Transformation'
  AND 'midmarket' = ANY(pricing_page_segments);

-- ============================================================================
-- Step 3: Insert MM Accelerator (base = AI Accelerator)
-- ============================================================================

INSERT INTO offer_bundles (
  name, description, bundle_items, bundle_price, total_retail_value,
  total_perceived_value, target_funnel_stages, bundle_type, is_active,
  base_bundle_id, pricing_page_segments, pricing_tier_slug, tagline,
  target_audience_display, pricing_display_order
)
SELECT
  'MM Accelerator',
  'Everything in the Accelerator plus enterprise SLA, priority support, and full data migration. Built for teams of 50+.',
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'content_type','service','content_id',s.id::text,'display_order',t.ord-1,
    'is_optional',false,'override_role',t.role,'override_perceived_value',t.val
  ) ORDER BY t.ord),'[]'::jsonb)
  FROM (VALUES (1,'Enterprise SLA','bonus',5000),(2,'Priority Support Channel','bonus',2500),(3,'Data Migration & Onboarding','core_offer',5000)) AS t(ord,title,role,val)
  JOIN services s ON s.title=t.title),
  14997, 47350, 47350,
  ARRAY['interested','informed']::TEXT[], 'standard', true,
  (SELECT id FROM offer_bundles WHERE name='AI Accelerator' LIMIT 1),
  ARRAY['midmarket']::TEXT[], 'mm-accelerator',
  'Deploy AI with enterprise-grade support',
  'Mid-Market Companies (50-500 Employees)', 1
WHERE NOT EXISTS (SELECT 1 FROM offer_bundles WHERE name='MM Accelerator');

-- ============================================================================
-- Step 4: Insert MM Growth Engine (base = Growth Engine)
-- ============================================================================

INSERT INTO offer_bundles (
  name, description, bundle_items, bundle_price, total_retail_value,
  total_perceived_value, target_funnel_stages, bundle_type, is_active,
  base_bundle_id, pricing_page_segments, pricing_tier_slug, tagline,
  target_audience_display, pricing_display_order, is_featured
)
SELECT
  'MM Growth Engine',
  'Full pipeline automation with enterprise integrations, priority support, and dedicated data migration. Scale AI across departments.',
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'content_type','service','content_id',s.id::text,'display_order',t.ord-1,
    'is_optional',false,'override_role',t.role,'override_perceived_value',t.val
  ) ORDER BY t.ord),'[]'::jsonb)
  FROM (VALUES (1,'Enterprise SLA','bonus',5000),(2,'Priority Support Channel','bonus',2500),(3,'Data Migration & Onboarding','core_offer',5000),(4,'Custom API / ERP Integrations','core_offer',7500)) AS t(ord,title,role,val)
  JOIN services s ON s.title=t.title),
  24997, 147850, 147850,
  ARRAY['informed','converted']::TEXT[], 'standard', true,
  (SELECT id FROM offer_bundles WHERE name='Growth Engine' LIMIT 1),
  ARRAY['midmarket']::TEXT[], 'mm-growth-engine',
  'AI across your entire pipeline with enterprise integrations',
  'Mid-Market Companies (50-500 Employees)', 2, true
WHERE NOT EXISTS (SELECT 1 FROM offer_bundles WHERE name='MM Growth Engine');

-- ============================================================================
-- Step 5: Insert MM Digital Transformation (base = Digital Transformation)
-- ============================================================================

INSERT INTO offer_bundles (
  name, description, bundle_items, bundle_price, total_retail_value,
  total_perceived_value, target_funnel_stages, bundle_type, is_active,
  base_bundle_id, pricing_page_segments, pricing_tier_slug, tagline,
  target_audience_display, pricing_display_order
)
SELECT
  'MM Digital Transformation',
  'Comprehensive AI transformation with full enterprise integration suite, custom reporting, and white-glove onboarding.',
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'content_type','service','content_id',s.id::text,'display_order',t.ord-1,
    'is_optional',false,'override_role',t.role,'override_perceived_value',t.val
  ) ORDER BY t.ord),'[]'::jsonb)
  FROM (VALUES (1,'Enterprise SLA','bonus',5000),(2,'Priority Support Channel','bonus',2500),(3,'Data Migration & Onboarding','core_offer',5000),(4,'Custom API / ERP Integrations','core_offer',7500),(5,'Custom Reporting & Analytics Dashboard','core_offer',5000)) AS t(ord,title,role,val)
  JOIN services s ON s.title=t.title),
  49997, 279350, 279350,
  ARRAY['informed','converted','active']::TEXT[], 'standard', true,
  (SELECT id FROM offer_bundles WHERE name='Digital Transformation' LIMIT 1),
  ARRAY['midmarket']::TEXT[], 'mm-digital-transformation',
  'Full enterprise AI transformation',
  'Mid-Market Companies (50-500 Employees)', 3
WHERE NOT EXISTS (SELECT 1 FROM offer_bundles WHERE name='MM Digital Transformation');
