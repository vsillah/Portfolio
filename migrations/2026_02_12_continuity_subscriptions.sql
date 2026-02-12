-- ============================================================================
-- Migration: Continuity Subscriptions (Recurring Billing)
-- Date: 2026-02-12
-- Purpose: Create continuity_plans and client_subscriptions tables for
--          Stripe recurring billing. Supports direct continuity offer
--          purchases and guarantee rollover credit spread over time.
--
-- Dependencies: guarantee_templates, guarantee_instances, content_offer_roles,
--               orders, user_profiles, services tables must exist.
--               Run AFTER 2026_02_12_guarantee_system.sql
-- ============================================================================

-- ============================================================================
-- 1. continuity_plans — recurring billing plan definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS continuity_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Display
  name TEXT NOT NULL,                      -- e.g. "Monthly Coaching Retainer"
  description TEXT,                        -- Client-facing description
  
  -- Service link (optional — what service this plan delivers)
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  
  -- Billing configuration
  billing_interval TEXT NOT NULL DEFAULT 'month'
    CHECK (billing_interval IN ('week', 'month', 'quarter', 'year')),
  billing_interval_count INTEGER NOT NULL DEFAULT 1,
  amount_per_interval NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  
  -- Commitment
  min_commitment_cycles INTEGER DEFAULT 0,   -- 0 = no minimum
  max_cycles INTEGER,                        -- NULL = indefinite
  trial_days INTEGER DEFAULT 0,
  
  -- Stripe sync
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  
  -- What's included each billing cycle
  features JSONB DEFAULT '[]'::jsonb,
  
  -- Policy
  cancellation_policy TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. client_subscriptions — per-client subscription tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Plan reference
  continuity_plan_id UUID NOT NULL REFERENCES continuity_plans(id) ON DELETE RESTRICT,
  
  -- Client info
  user_id UUID REFERENCES user_profiles(id),
  client_email TEXT NOT NULL,
  client_name TEXT,
  
  -- Origin
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  guarantee_instance_id UUID REFERENCES guarantee_instances(id) ON DELETE SET NULL,
  
  -- Stripe sync
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  
  -- Status (mirrors Stripe subscription statuses)
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  
  -- Billing periods
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cycles_completed INTEGER DEFAULT 0,
  
  -- Guarantee rollover credit tracking
  credit_remaining NUMERIC(10,2) DEFAULT 0,
  credit_total NUMERIC(10,2) DEFAULT 0,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Add continuity_plan_id FK to content_offer_roles
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'content_offer_roles'
      AND column_name = 'continuity_plan_id'
  ) THEN
    ALTER TABLE content_offer_roles
      ADD COLUMN continuity_plan_id UUID REFERENCES continuity_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. Add rollover_continuity_plan_id FK to guarantee_templates (deferred from first migration)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'guarantee_templates'
      AND column_name = 'rollover_continuity_plan_id'
  ) THEN
    -- Column exists from first migration but without FK; add the constraint now
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'guarantee_templates'
        AND ccu.column_name = 'rollover_continuity_plan_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE guarantee_templates
        ADD CONSTRAINT guarantee_templates_rollover_continuity_plan_fk
        FOREIGN KEY (rollover_continuity_plan_id) REFERENCES continuity_plans(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 5. Add subscription_id FK to guarantee_instances (deferred from first migration)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'guarantee_instances'
      AND column_name = 'subscription_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'guarantee_instances'
        AND ccu.column_name = 'subscription_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE guarantee_instances
        ADD CONSTRAINT guarantee_instances_subscription_fk
        FOREIGN KEY (subscription_id) REFERENCES client_subscriptions(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 6. Add stripe_customer_id to orders (for linking guest purchases to Stripe Customer)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- ============================================================================
-- 7. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_continuity_plans_active
  ON continuity_plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_continuity_plans_service
  ON continuity_plans(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_continuity_plans_stripe_product
  ON continuity_plans(stripe_product_id) WHERE stripe_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_plan
  ON client_subscriptions(continuity_plan_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_user
  ON client_subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_email
  ON client_subscriptions(client_email);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_status
  ON client_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_stripe
  ON client_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_guarantee
  ON client_subscriptions(guarantee_instance_id) WHERE guarantee_instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_offer_roles_continuity
  ON content_offer_roles(continuity_plan_id) WHERE continuity_plan_id IS NOT NULL;

-- ============================================================================
-- 8. Row Level Security
-- ============================================================================
ALTER TABLE continuity_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

-- continuity_plans: admins manage, public read active
DROP POLICY IF EXISTS "Admins can manage continuity plans" ON continuity_plans;
CREATE POLICY "Admins can manage continuity plans"
  ON continuity_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can view active continuity plans" ON continuity_plans;
CREATE POLICY "Public can view active continuity plans"
  ON continuity_plans FOR SELECT
  USING (is_active = true);

-- client_subscriptions: admins manage all, clients read own
DROP POLICY IF EXISTS "Admins can manage client subscriptions" ON client_subscriptions;
CREATE POLICY "Admins can manage client subscriptions"
  ON client_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Clients can view own subscriptions" ON client_subscriptions;
CREATE POLICY "Clients can view own subscriptions"
  ON client_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- 9. Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_continuity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS continuity_plans_updated_at ON continuity_plans;
CREATE TRIGGER continuity_plans_updated_at
  BEFORE UPDATE ON continuity_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_continuity_updated_at();

DROP TRIGGER IF EXISTS client_subscriptions_updated_at ON client_subscriptions;
CREATE TRIGGER client_subscriptions_updated_at
  BEFORE UPDATE ON client_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_continuity_updated_at();
