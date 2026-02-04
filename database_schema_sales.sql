-- Sales Script Admin System - Database Schema
-- Run this SQL in Supabase SQL Editor
-- Implements Alex Hormozi's offer frameworks for sales conversations

-- ============================================================================
-- Product Offer Roles - Classify products using Hormozi framework
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_offer_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Hormozi offer classification
  offer_role TEXT NOT NULL CHECK (offer_role IN (
    'core_offer',           -- Main product/service being sold
    'bonus',                -- Added value to increase perceived worth
    'upsell',               -- More/Better/New products
    'downsell',             -- Reduced feature/payment plan option
    'continuity',           -- Subscription/recurring offer
    'lead_magnet',          -- Free offer to generate leads
    'decoy',                -- Lower value option to contrast with premium
    'anchor'                -- High-price item to make main offer seem reasonable
  )),
  
  -- Value equation components (from Hormozi)
  -- Value = (Dream Outcome × Likelihood) / (Time Delay × Effort)
  dream_outcome_description TEXT,      -- What result does this deliver?
  likelihood_multiplier INTEGER CHECK (likelihood_multiplier BETWEEN 1 AND 10),
  time_reduction INTEGER,              -- Days/weeks saved
  effort_reduction INTEGER CHECK (effort_reduction BETWEEN 1 AND 10),
  
  -- Pricing context
  retail_price DECIMAL(10,2),          -- Full price (for anchoring)
  offer_price DECIMAL(10,2),           -- Price when part of offer
  perceived_value DECIMAL(10,2),       -- Value to communicate
  
  -- Bonus-specific fields
  bonus_name TEXT,                     -- Special name with benefit in title
  bonus_description TEXT,              -- How it relates to their goals
  
  -- Conditions (for attraction offers)
  qualifying_actions JSONB,            -- Actions client must take
  payout_type TEXT CHECK (payout_type IN ('credit', 'refund', 'rollover', NULL)),
  
  -- Metadata
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure a product can only have one role at a time
  UNIQUE(product_id)
);

-- ============================================================================
-- Sales Scripts - Guided conversation flows
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Offer type this script is designed for
  offer_type TEXT NOT NULL CHECK (offer_type IN (
    'attraction',    -- Win your money back offers
    'upsell',        -- More/Better/New products
    'downsell',      -- Payment plans, reduced features
    'continuity',    -- Subscription/recurring offers
    'core',          -- Main offer presentation
    'objection'      -- Objection handling scripts
  )),
  
  -- Script content structure
  -- {
  --   steps: [{ id, title, talking_points: [], actions: [] }],
  --   objection_handlers: [{ trigger, response }],
  --   success_metrics: []
  -- }
  script_content JSONB NOT NULL,
  
  -- Targeting
  target_funnel_stage TEXT[] DEFAULT '{}',  -- Which client stages this applies to
  qualifying_criteria JSONB,                 -- Conditions from diagnostic data
  associated_products BIGINT[] DEFAULT '{}', -- Product IDs to present with this script
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Sales Sessions - Track sales conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to diagnostic audit (if coming from assessment)
  diagnostic_audit_id UUID REFERENCES diagnostic_audits(id) ON DELETE SET NULL,
  
  -- Client info (if no diagnostic audit)
  client_name TEXT,
  client_email TEXT,
  client_company TEXT,
  
  -- Sales agent
  sales_agent_id UUID REFERENCES auth.users(id),
  
  -- Session state
  funnel_stage TEXT NOT NULL DEFAULT 'prospect' CHECK (funnel_stage IN (
    'prospect',     -- Just started
    'interested',   -- Showed interest
    'informed',     -- Received information
    'converted',    -- Made a purchase
    'active',       -- Ongoing customer
    'upgraded'      -- Purchased additional products
  )),
  
  -- Current script being used
  current_script_id UUID REFERENCES sales_scripts(id),
  current_step_index INTEGER DEFAULT 0,
  
  -- History tracking
  offers_presented JSONB[] DEFAULT '{}',      -- History of offers shown
  products_presented BIGINT[] DEFAULT '{}',   -- Products shown during session
  scripts_used UUID[] DEFAULT '{}',           -- Scripts that were used
  
  -- Notes and responses
  client_responses JSONB,                     -- Notes and responses
  objections_handled JSONB[] DEFAULT '{}',    -- Objections and how they were handled
  internal_notes TEXT,                        -- Agent's private notes
  
  -- Outcome
  outcome TEXT CHECK (outcome IN (
    'converted',      -- Made a purchase
    'downsold',       -- Accepted a lower offer
    'deferred',       -- Needs follow-up
    'lost',           -- Not interested
    'in_progress'     -- Still ongoing
  )) DEFAULT 'in_progress',
  
  -- Follow-up
  next_follow_up TIMESTAMPTZ,
  follow_up_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Offer Bundles - Pre-configured product bundles for Grand Slam Offers
-- ============================================================================
CREATE TABLE IF NOT EXISTS offer_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Bundle contents
  -- [{ product_id, role, display_order }]
  bundle_items JSONB NOT NULL DEFAULT '[]',
  
  -- Pricing
  total_retail_value DECIMAL(10,2),    -- Sum of all retail prices
  total_perceived_value DECIMAL(10,2), -- Sum of all perceived values
  bundle_price DECIMAL(10,2),          -- Actual bundle price
  
  -- Target audience
  target_funnel_stages TEXT[] DEFAULT '{}',
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_product_offer_roles_product ON product_offer_roles(product_id);
CREATE INDEX IF NOT EXISTS idx_product_offer_roles_role ON product_offer_roles(offer_role);
CREATE INDEX IF NOT EXISTS idx_product_offer_roles_active ON product_offer_roles(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sales_scripts_offer_type ON sales_scripts(offer_type);
CREATE INDEX IF NOT EXISTS idx_sales_scripts_active ON sales_scripts(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sales_sessions_audit ON sales_sessions(diagnostic_audit_id);
CREATE INDEX IF NOT EXISTS idx_sales_sessions_agent ON sales_sessions(sales_agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_sessions_outcome ON sales_sessions(outcome);
CREATE INDEX IF NOT EXISTS idx_sales_sessions_follow_up ON sales_sessions(next_follow_up) WHERE next_follow_up IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offer_bundles_active ON offer_bundles(is_active) WHERE is_active = true;

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE product_offer_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_bundles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies - Admin only access
-- ============================================================================

-- Product Offer Roles - Admin only
DROP POLICY IF EXISTS "Admins can manage product offer roles" ON product_offer_roles;
CREATE POLICY "Admins can manage product offer roles"
  ON product_offer_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public read for product offer roles (for offer display)
DROP POLICY IF EXISTS "Public can view active product roles" ON product_offer_roles;
CREATE POLICY "Public can view active product roles"
  ON product_offer_roles FOR SELECT
  USING (is_active = true);

-- Sales Scripts - Admin only
DROP POLICY IF EXISTS "Admins can manage sales scripts" ON sales_scripts;
CREATE POLICY "Admins can manage sales scripts"
  ON sales_scripts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Sales Sessions - Admin only
DROP POLICY IF EXISTS "Admins can manage sales sessions" ON sales_sessions;
CREATE POLICY "Admins can manage sales sessions"
  ON sales_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Offer Bundles - Admin can manage, public can view active
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

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_offer_roles_updated_at ON product_offer_roles;
CREATE TRIGGER product_offer_roles_updated_at
  BEFORE UPDATE ON product_offer_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_at();

DROP TRIGGER IF EXISTS sales_scripts_updated_at ON sales_scripts;
CREATE TRIGGER sales_scripts_updated_at
  BEFORE UPDATE ON sales_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_at();

DROP TRIGGER IF EXISTS sales_sessions_updated_at ON sales_sessions;
CREATE TRIGGER sales_sessions_updated_at
  BEFORE UPDATE ON sales_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_at();

DROP TRIGGER IF EXISTS offer_bundles_updated_at ON offer_bundles;
CREATE TRIGGER offer_bundles_updated_at
  BEFORE UPDATE ON offer_bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_at();

-- ============================================================================
-- Helper Views
-- ============================================================================

-- View to get products with their offer roles
CREATE OR REPLACE VIEW products_with_roles AS
SELECT 
  p.*,
  por.id as role_id,
  por.offer_role,
  por.dream_outcome_description,
  por.likelihood_multiplier,
  por.time_reduction,
  por.effort_reduction,
  por.retail_price as role_retail_price,
  por.offer_price,
  por.perceived_value,
  por.bonus_name,
  por.bonus_description,
  por.qualifying_actions,
  por.payout_type,
  por.display_order as role_display_order,
  por.is_active as role_is_active
FROM products p
LEFT JOIN product_offer_roles por ON p.id = por.product_id;

-- View to get diagnostic audits ready for sales follow-up
CREATE OR REPLACE VIEW sales_ready_audits AS
SELECT 
  da.*,
  cs.email as contact_email,
  cs.name as contact_name,
  cs.company as contact_company,
  ss.id as existing_session_id,
  ss.outcome as session_outcome,
  ss.next_follow_up
FROM diagnostic_audits da
LEFT JOIN contact_submissions cs ON da.contact_submission_id = cs.id
LEFT JOIN sales_sessions ss ON da.id = ss.diagnostic_audit_id
WHERE da.status = 'completed'
ORDER BY da.started_at DESC;
