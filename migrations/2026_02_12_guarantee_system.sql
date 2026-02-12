-- ============================================================================
-- Migration: Guarantee System (Hormozi Conditional Guarantee)
-- Date: 2026-02-12
-- Purpose: Create guarantee_templates, guarantee_instances, and
--          guarantee_milestones tables for tracking conditional money-back
--          guarantees inspired by Alex Hormozi's $100M Offers model.
--
-- Dependencies: content_offer_roles, orders, order_items, user_profiles,
--               discount_codes tables must exist.
--
-- Apply order: Run this BEFORE 2026_02_12_continuity_subscriptions.sql
-- ============================================================================

-- ============================================================================
-- 1. guarantee_templates — reusable guarantee definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS guarantee_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Display
  name TEXT NOT NULL,                      -- e.g. "90-Day ROI Guarantee"
  description TEXT,                        -- Client-facing explanation
  
  -- Guarantee type
  guarantee_type TEXT NOT NULL DEFAULT 'conditional'
    CHECK (guarantee_type IN ('conditional', 'unconditional')),
  
  -- Duration
  duration_days INTEGER NOT NULL DEFAULT 90,
  
  -- Conditions (structured array for conditional guarantees)
  -- Each element: { id, label, verification_method, required }
  -- verification_method: 'admin_verified' | 'client_self_report'
  conditions JSONB DEFAULT '[]'::jsonb,
  
  -- Payout configuration
  default_payout_type TEXT NOT NULL DEFAULT 'refund'
    CHECK (default_payout_type IN ('refund', 'credit', 'rollover_upsell', 'rollover_continuity')),
  payout_amount_type TEXT NOT NULL DEFAULT 'full'
    CHECK (payout_amount_type IN ('full', 'partial', 'fixed')),
  payout_amount_value NUMERIC(10,2),       -- For 'partial' (percentage 0-100) or 'fixed' (dollar amount)
  
  -- Rollover configuration
  rollover_upsell_service_ids UUID[],      -- Services the upsell credit applies to
  rollover_continuity_plan_id UUID,        -- FK added after continuity_plans table exists
  rollover_bonus_multiplier NUMERIC(4,2) DEFAULT 1.0,  -- e.g. 1.25 = 25% bonus on rollover
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. guarantee_instances — activated guarantees per purchase
-- ============================================================================
CREATE TABLE IF NOT EXISTS guarantee_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Purchase link
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id BIGINT REFERENCES order_items(id) ON DELETE SET NULL,
  guarantee_template_id UUID NOT NULL REFERENCES guarantee_templates(id) ON DELETE RESTRICT,
  
  -- Client info (denormalized for notifications)
  client_email TEXT NOT NULL,
  client_name TEXT,
  user_id UUID REFERENCES user_profiles(id),
  
  -- Financial
  purchase_amount NUMERIC(10,2) NOT NULL,
  payout_type TEXT NOT NULL
    CHECK (payout_type IN ('refund', 'credit', 'rollover_upsell', 'rollover_continuity')),
  
  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'active',                    -- Guarantee window is open
      'conditions_met',            -- All conditions met, awaiting client choice
      'refund_issued',             -- Refund processed via Stripe
      'credit_issued',             -- Discount code generated
      'rollover_upsell_applied',   -- One-time upsell credit applied
      'rollover_continuity_applied', -- Subscription credit applied
      'expired',                   -- Window closed with unmet conditions
      'voided'                     -- Manually voided by admin
    )),
  
  -- Conditions (frozen snapshot at purchase time)
  conditions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Time window
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  stripe_refund_id TEXT,
  discount_code_id BIGINT REFERENCES discount_codes(id),
  subscription_id UUID,                    -- FK added after client_subscriptions table exists
  rollover_credit_amount NUMERIC(10,2),    -- Calculated credit after bonus multiplier
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. guarantee_milestones — condition tracking per instance
-- ============================================================================
CREATE TABLE IF NOT EXISTS guarantee_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Parent
  guarantee_instance_id UUID NOT NULL REFERENCES guarantee_instances(id) ON DELETE CASCADE,
  
  -- Condition reference (matches conditions_snapshot[].id)
  condition_id TEXT NOT NULL,
  condition_label TEXT NOT NULL,
  
  -- Progress
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'met', 'not_met', 'waived')),
  
  -- Verification
  verified_by UUID REFERENCES user_profiles(id),
  verified_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  -- Client self-report
  client_evidence TEXT,
  client_submitted_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each condition tracked once per instance
  UNIQUE(guarantee_instance_id, condition_id)
);

-- ============================================================================
-- 4. Add guarantee_template_id FK to content_offer_roles
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'content_offer_roles'
      AND column_name = 'guarantee_template_id'
  ) THEN
    ALTER TABLE content_offer_roles
      ADD COLUMN guarantee_template_id UUID REFERENCES guarantee_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 5. Update payout_type CHECK constraints
-- ============================================================================

-- content_offer_roles: expand payout_type to include rollover_upsell and rollover_continuity
ALTER TABLE content_offer_roles DROP CONSTRAINT IF EXISTS content_offer_roles_payout_type_check;
ALTER TABLE content_offer_roles
  ADD CONSTRAINT content_offer_roles_payout_type_check
  CHECK (payout_type IN ('credit', 'refund', 'rollover', 'rollover_upsell', 'rollover_continuity', NULL));

-- product_offer_roles (legacy): same expansion if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_offer_roles') THEN
    ALTER TABLE product_offer_roles DROP CONSTRAINT IF EXISTS product_offer_roles_payout_type_check;
    ALTER TABLE product_offer_roles
      ADD CONSTRAINT product_offer_roles_payout_type_check
      CHECK (payout_type IN ('credit', 'refund', 'rollover', 'rollover_upsell', 'rollover_continuity', NULL));
  END IF;
END $$;

-- ============================================================================
-- 6. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_guarantee_templates_active
  ON guarantee_templates(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_guarantee_instances_order
  ON guarantee_instances(order_id);
CREATE INDEX IF NOT EXISTS idx_guarantee_instances_template
  ON guarantee_instances(guarantee_template_id);
CREATE INDEX IF NOT EXISTS idx_guarantee_instances_status
  ON guarantee_instances(status);
CREATE INDEX IF NOT EXISTS idx_guarantee_instances_user
  ON guarantee_instances(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guarantee_instances_email
  ON guarantee_instances(client_email);
CREATE INDEX IF NOT EXISTS idx_guarantee_instances_expires
  ON guarantee_instances(expires_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_guarantee_milestones_instance
  ON guarantee_milestones(guarantee_instance_id);
CREATE INDEX IF NOT EXISTS idx_guarantee_milestones_status
  ON guarantee_milestones(status);

CREATE INDEX IF NOT EXISTS idx_content_offer_roles_guarantee
  ON content_offer_roles(guarantee_template_id) WHERE guarantee_template_id IS NOT NULL;

-- ============================================================================
-- 7. Row Level Security
-- ============================================================================
ALTER TABLE guarantee_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantee_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantee_milestones ENABLE ROW LEVEL SECURITY;

-- guarantee_templates: admins manage, public read active
DROP POLICY IF EXISTS "Admins can manage guarantee templates" ON guarantee_templates;
CREATE POLICY "Admins can manage guarantee templates"
  ON guarantee_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can view active guarantee templates" ON guarantee_templates;
CREATE POLICY "Public can view active guarantee templates"
  ON guarantee_templates FOR SELECT
  USING (is_active = true);

-- guarantee_instances: admins manage all, clients read own
DROP POLICY IF EXISTS "Admins can manage guarantee instances" ON guarantee_instances;
CREATE POLICY "Admins can manage guarantee instances"
  ON guarantee_instances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Clients can view own guarantee instances" ON guarantee_instances;
CREATE POLICY "Clients can view own guarantee instances"
  ON guarantee_instances FOR SELECT
  USING (user_id = auth.uid());

-- guarantee_milestones: admins manage, clients read/update own
DROP POLICY IF EXISTS "Admins can manage guarantee milestones" ON guarantee_milestones;
CREATE POLICY "Admins can manage guarantee milestones"
  ON guarantee_milestones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Clients can view own milestones" ON guarantee_milestones;
CREATE POLICY "Clients can view own milestones"
  ON guarantee_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guarantee_instances gi
      WHERE gi.id = guarantee_instance_id AND gi.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients can update own milestones" ON guarantee_milestones;
CREATE POLICY "Clients can update own milestones"
  ON guarantee_milestones FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM guarantee_instances gi
      WHERE gi.id = guarantee_instance_id AND gi.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guarantee_instances gi
      WHERE gi.id = guarantee_instance_id AND gi.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_guarantee_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guarantee_templates_updated_at ON guarantee_templates;
CREATE TRIGGER guarantee_templates_updated_at
  BEFORE UPDATE ON guarantee_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_guarantee_updated_at();

DROP TRIGGER IF EXISTS guarantee_instances_updated_at ON guarantee_instances;
CREATE TRIGGER guarantee_instances_updated_at
  BEFORE UPDATE ON guarantee_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_guarantee_updated_at();

DROP TRIGGER IF EXISTS guarantee_milestones_updated_at ON guarantee_milestones;
CREATE TRIGGER guarantee_milestones_updated_at
  BEFORE UPDATE ON guarantee_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_guarantee_updated_at();
