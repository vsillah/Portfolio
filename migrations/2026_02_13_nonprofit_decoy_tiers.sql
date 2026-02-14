-- ============================================================================
-- Migration: Community Impact (Nonprofit/Education) Decoy Tiers
-- Date: 2026-02-13
-- Purpose: Add decoy-offer columns to offer_bundles, seed Community Impact
--          bundles and self-serve services for non-profits and educational
--          institutions. Also adds org_type to diagnostic_audits.
--
-- Dependencies: offer_bundles, services, diagnostic_audits tables must exist.
-- ============================================================================

-- ============================================================================
-- 1. Extend offer_bundles with decoy/audience columns
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'target_audience'
  ) THEN
    ALTER TABLE offer_bundles ADD COLUMN target_audience TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'is_decoy'
  ) THEN
    ALTER TABLE offer_bundles ADD COLUMN is_decoy BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'mirrors_tier_id'
  ) THEN
    ALTER TABLE offer_bundles ADD COLUMN mirrors_tier_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'has_guarantee'
  ) THEN
    ALTER TABLE offer_bundles ADD COLUMN has_guarantee BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_offer_bundles_is_decoy
  ON offer_bundles(is_decoy) WHERE is_decoy = true;
CREATE INDEX IF NOT EXISTS idx_offer_bundles_target_audience
  ON offer_bundles USING GIN (target_audience);

-- ============================================================================
-- 2. Add org_type to diagnostic_audits
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'diagnostic_audits' AND column_name = 'org_type'
  ) THEN
    ALTER TABLE diagnostic_audits
      ADD COLUMN org_type TEXT DEFAULT 'for_profit'
      CHECK (org_type IN ('for_profit', 'nonprofit', 'education'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_org_type
  ON diagnostic_audits(org_type) WHERE org_type != 'for_profit';

-- ============================================================================
-- 3. Seed CI-specific services
-- ============================================================================
INSERT INTO services (title, service_type, price, is_quote_based, delivery_method, description, duration_hours, duration_description, display_order, is_featured, is_active, topics, deliverables)
SELECT * FROM (VALUES
  (
    'AI Strategy Workshop — Recorded (Self-Paced)'::TEXT,
    'workshop'::TEXT,
    297.00::DECIMAL(10,2),
    false,
    'virtual'::TEXT,
    'Self-paced recorded version of our half-day AI Strategy Workshop. Discover where AI fits in your organization at your own pace.'::TEXT,
    4.0::DECIMAL(6,2),
    'Self-paced (approx. 4 hours of content)'::TEXT,
    30,
    false,
    true,
    '["AI Opportunity Assessment", "ROI Prioritization", "Implementation Roadmap", "Self-Assessment Exercises"]'::JSONB,
    '["Recorded workshop videos", "AI opportunity worksheet", "ROI template spreadsheets", "Implementation roadmap template"]'::JSONB
  ),
  (
    'Pre-Built Chatbot Template — Self-Install'::TEXT,
    'consulting'::TEXT,
    997.00::DECIMAL(10,2),
    false,
    'virtual'::TEXT,
    'Ready-to-deploy AI chatbot template with step-by-step self-installation guide. Handles FAQs, basic routing, and information capture.'::TEXT,
    2.0::DECIMAL(6,2),
    'Self-install (2 hours estimated setup)'::TEXT,
    31,
    false,
    true,
    '["Template Configuration", "Self-Install Guide", "FAQ Setup", "Basic Customization"]'::JSONB,
    '["Chatbot template package", "Step-by-step install guide", "Configuration checklist", "FAQ import template"]'::JSONB
  ),
  (
    'Group Implementation Program — 6 Weeks'::TEXT,
    'training'::TEXT,
    2497.00::DECIMAL(10,2),
    false,
    'virtual'::TEXT,
    'Bi-weekly group implementation calls over 6 weeks. Deploy template-based AI tools alongside peers with shared guidance and accountability.'::TEXT,
    12.0::DECIMAL(6,2),
    '6 weeks (bi-weekly 2-hour sessions)'::TEXT,
    32,
    false,
    true,
    '["Group Deployment", "Template Configuration", "Peer Learning", "Q&A Sessions"]'::JSONB,
    '["6 group call recordings", "Template tool configurations", "Shared resource library", "Community access"]'::JSONB
  ),
  (
    'AI Training Library — Recorded Access'::TEXT,
    'training'::TEXT,
    197.00::DECIMAL(10,2),
    false,
    'virtual'::TEXT,
    'Full access to our recorded AI training library. Covers fundamentals, tool usage, prompt engineering, and best practices for your team.'::TEXT,
    20.0::DECIMAL(6,2),
    '20+ hours of recorded content'::TEXT,
    33,
    false,
    true,
    '["AI Fundamentals", "Prompt Engineering", "Tool Usage Guides", "Best Practices"]'::JSONB,
    '["Training video library access", "Exercise workbooks (PDF)", "Quick reference guides", "12-month access"]'::JSONB
  )
) AS v(title, service_type, price, is_quote_based, delivery_method, description, duration_hours, duration_description, display_order, is_featured, is_active, topics, deliverables)
WHERE NOT EXISTS (
  SELECT 1 FROM services s WHERE s.title = v.title
);

-- ============================================================================
-- 4. Seed Community Impact bundles
-- ============================================================================

-- CI Starter (mirrors quick-win)
INSERT INTO offer_bundles (name, description, bundle_items, total_retail_value, total_perceived_value, bundle_price, target_funnel_stages, is_active, bundle_type, is_decoy, target_audience, mirrors_tier_id, has_guarantee)
SELECT
  'Community Impact Starter',
  'Discover where AI fits in your organization. Self-paced delivery designed for nonprofits and educational institutions.',
  '[
    {"content_type":"service","content_id":"ci-workshop-recorded","display_order":0,"is_optional":false,"override_role":"core_offer","override_price":500,"override_perceived_value":500,"override_dream_outcome":"Discover your top AI opportunities at your own pace"},
    {"content_type":"service","content_id":"ci-training-library","display_order":1,"is_optional":false,"override_role":"bonus","override_price":200,"override_perceived_value":200,"override_dream_outcome":"Team-wide AI literacy"},
    {"content_type":"service","content_id":"ci-roi-templates","display_order":2,"is_optional":false,"override_role":"bonus","override_price":150,"override_perceived_value":150,"override_dream_outcome":"Quantify your AI ROI"},
    {"content_type":"service","content_id":"ci-community","display_order":3,"is_optional":false,"override_role":"bonus","override_price":300,"override_perceived_value":300,"override_dream_outcome":"Peer support from similar organizations"},
    {"content_type":"service","content_id":"ci-playbook","display_order":4,"is_optional":false,"override_role":"bonus","override_price":200,"override_perceived_value":200,"override_dream_outcome":"Step-by-step implementation guide"}
  ]'::JSONB,
  1350.00,
  1500.00,
  297.00,
  ARRAY['prospect', 'interested']::TEXT[],
  true,
  'decoy',
  true,
  ARRAY['nonprofit', 'education']::TEXT[],
  'quick-win',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM offer_bundles WHERE name = 'Community Impact Starter'
);

-- CI Accelerator (mirrors accelerator)
INSERT INTO offer_bundles (name, description, bundle_items, total_retail_value, total_perceived_value, bundle_price, target_funnel_stages, is_active, bundle_type, is_decoy, target_audience, mirrors_tier_id, has_guarantee)
SELECT
  'Community Impact Accelerator',
  'Deploy your first AI tool with template-based delivery. Self-install chatbot, group onboarding, and recorded training.',
  '[
    {"content_type":"service","content_id":"ci-workshop-recorded","display_order":0,"is_optional":false,"override_role":"bonus","override_price":500,"override_perceived_value":500,"override_dream_outcome":"AI strategy foundation"},
    {"content_type":"service","content_id":"ci-chatbot-template","display_order":1,"is_optional":false,"override_role":"core_offer","override_price":3000,"override_perceived_value":3000,"override_dream_outcome":"24/7 AI chatbot handling FAQs and routing"},
    {"content_type":"service","content_id":"ci-training-library","display_order":2,"is_optional":false,"override_role":"bonus","override_price":500,"override_perceived_value":500,"override_dream_outcome":"Team AI training at your own pace"},
    {"content_type":"service","content_id":"ci-group-onboarding","display_order":3,"is_optional":false,"override_role":"bonus","override_price":1500,"override_perceived_value":1500,"override_dream_outcome":"Guided group deployment over 6 weeks"},
    {"content_type":"service","content_id":"ci-email-support-30","display_order":4,"is_optional":false,"override_role":"bonus","override_price":500,"override_perceived_value":500,"override_dream_outcome":"30-day email support for questions"},
    {"content_type":"service","content_id":"ci-community","display_order":5,"is_optional":false,"override_role":"bonus","override_price":300,"override_perceived_value":300,"override_dream_outcome":"Peer support community access"},
    {"content_type":"service","content_id":"ci-playbook","display_order":6,"is_optional":false,"override_role":"bonus","override_price":200,"override_perceived_value":200,"override_dream_outcome":"Implementation playbook"}
  ]'::JSONB,
  6500.00,
  8000.00,
  1997.00,
  ARRAY['prospect', 'interested', 'informed']::TEXT[],
  true,
  'decoy',
  true,
  ARRAY['nonprofit', 'education']::TEXT[],
  'accelerator',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM offer_bundles WHERE name = 'Community Impact Accelerator'
);

-- CI Growth (mirrors growth-engine)
INSERT INTO offer_bundles (name, description, bundle_items, total_retail_value, total_perceived_value, bundle_price, target_funnel_stages, is_active, bundle_type, is_decoy, target_audience, mirrors_tier_id, has_guarantee)
SELECT
  'Community Impact Growth',
  'AI across lead gen, content, and operations. Template-based tools with group implementation and shared analytics.',
  '[
    {"content_type":"service","content_id":"ci-workshop-recorded","display_order":0,"is_optional":false,"override_role":"bonus","override_price":500,"override_perceived_value":500,"override_dream_outcome":"AI strategy foundation"},
    {"content_type":"service","content_id":"ci-chatbot-template","display_order":1,"is_optional":false,"override_role":"core_offer","override_price":3000,"override_perceived_value":3000,"override_dream_outcome":"24/7 AI chatbot for your organization"},
    {"content_type":"service","content_id":"ci-lead-template","display_order":2,"is_optional":false,"override_role":"core_offer","override_price":4000,"override_perceived_value":4000,"override_dream_outcome":"Template-based lead tracking system"},
    {"content_type":"service","content_id":"ci-content-templates","display_order":3,"is_optional":false,"override_role":"core_offer","override_price":3000,"override_perceived_value":3000,"override_dream_outcome":"Social media content templates and automation"},
    {"content_type":"service","content_id":"ci-group-implementation","display_order":4,"is_optional":false,"override_role":"bonus","override_price":3500,"override_perceived_value":3500,"override_dream_outcome":"6-week group implementation program"},
    {"content_type":"service","content_id":"ci-training-library","display_order":5,"is_optional":false,"override_role":"bonus","override_price":500,"override_perceived_value":500,"override_dream_outcome":"Full training library access"},
    {"content_type":"service","content_id":"ci-shared-analytics","display_order":6,"is_optional":false,"override_role":"bonus","override_price":2000,"override_perceived_value":2000,"override_dream_outcome":"Shared analytics dashboard"},
    {"content_type":"service","content_id":"ci-email-support-60","display_order":7,"is_optional":false,"override_role":"bonus","override_price":1000,"override_perceived_value":1000,"override_dream_outcome":"60-day email support"},
    {"content_type":"service","content_id":"ci-community","display_order":8,"is_optional":false,"override_role":"bonus","override_price":300,"override_perceived_value":300,"override_dream_outcome":"Peer community access"},
    {"content_type":"service","content_id":"ci-email-templates","display_order":9,"is_optional":false,"override_role":"bonus","override_price":2000,"override_perceived_value":2000,"override_dream_outcome":"AI email sequence templates"},
    {"content_type":"service","content_id":"ci-playbook","display_order":10,"is_optional":false,"override_role":"bonus","override_price":200,"override_perceived_value":200,"override_dream_outcome":"Implementation playbook"}
  ]'::JSONB,
  20000.00,
  25000.00,
  4997.00,
  ARRAY['prospect', 'interested', 'informed']::TEXT[],
  true,
  'decoy',
  true,
  ARRAY['nonprofit', 'education']::TEXT[],
  'growth-engine',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM offer_bundles WHERE name = 'Community Impact Growth'
);

-- ============================================================================
-- 5. Seed Community Impact sales script
-- ============================================================================
INSERT INTO sales_scripts (name, description, offer_type, target_funnel_stage, script_content, is_active)
SELECT
  'Community Impact Presentation',
  'Script for presenting Community Impact (decoy) tiers to non-profit and educational institution prospects. Acknowledges budget constraints while demonstrating value and presenting upgrade path.',
  'downsell',
  ARRAY['prospect', 'interested', 'informed']::TEXT[],
  '{
    "steps": [
      {
        "id": "1",
        "title": "Acknowledge Their Mission",
        "talking_points": [
          "\"Thank you for sharing about your organization. We deeply value the work nonprofits and educational institutions do.\"",
          "\"We understand that budget constraints are a real consideration — that is exactly why we created our Community Impact program.\"",
          "\"Our goal is to make AI accessible to organizations like yours, so you can amplify your mission with technology.\""
        ],
        "actions": ["Note specific mission/impact details", "Confirm org type (nonprofit vs education)"]
      },
      {
        "id": "2",
        "title": "Present Community Impact Options",
        "talking_points": [
          "\"We have three Community Impact packages designed specifically for organizations like yours.\"",
          "\"These deliver the same outcomes as our full-service tiers, with self-paced and template-based delivery to keep costs accessible.\"",
          "\"Let me walk you through the options and help you find the right fit for your budget and goals.\""
        ],
        "actions": ["Present CI Starter, CI Accelerator, and CI Growth side by side", "Ask about budget range"]
      },
      {
        "id": "3",
        "title": "Highlight Value Despite Lower Price",
        "talking_points": [
          "\"Even at the Community Impact level, you are getting proven AI tools and frameworks — the same methodology we use with our premium clients.\"",
          "\"The main difference is delivery method: self-paced instead of live, templates instead of custom builds, and group support instead of dedicated 1-on-1.\"",
          "\"Many of our Community Impact clients still see significant ROI — the tools work the same way regardless of package level.\""
        ],
        "actions": ["Walk through ROI calculator with their numbers", "Show specific outcomes for similar orgs"]
      },
      {
        "id": "4",
        "title": "Present Upgrade Path",
        "talking_points": [
          "\"I also want you to know about our full-service options, in case your budget allows or you secure additional funding.\"",
          "\"The full tiers include custom-deployed tools, dedicated coaching, and outcome-based guarantees.\"",
          "\"Many organizations start with Community Impact and upgrade later as they see results. The investment you make now carries forward.\""
        ],
        "actions": ["Show side-by-side comparison of CI vs premium", "Note interest level in premium tiers"]
      },
      {
        "id": "5",
        "title": "Close or Schedule Follow-up",
        "talking_points": [
          "\"Based on what we discussed, which option feels like the best fit for your organization right now?\"",
          "\"Remember, there is no wrong choice here — any of these packages will move your organization forward with AI.\"",
          "\"Would you like to get started today, or would it help to share this with your team first?\""
        ],
        "actions": ["Get commitment or schedule follow-up", "Send comparison document if needed"]
      }
    ],
    "objection_handlers": [
      {
        "trigger": "even CI is too expensive",
        "response": "I understand. Let me show you our free AI Audit Calculator — it will help you quantify the value and make the case for budget allocation. Also, many organizations fund this through grants or professional development budgets."
      },
      {
        "trigger": "want the full version",
        "response": "Great news — we can absolutely do that! Let me walk you through our full-service options. The premium tiers include custom deployment, dedicated support, and outcome guarantees."
      }
    ],
    "success_metrics": [
      "CI bundle selected",
      "Premium upgrade expressed",
      "Follow-up scheduled"
    ]
  }'::JSONB,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM sales_scripts WHERE name = 'Community Impact Presentation'
);
