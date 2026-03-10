-- ============================================================================
-- Migration: Offer cost columns and cost_events table
-- Date: 2026-03-10
-- Purpose: Add cost structure tracking for offers and usage-based cost events.
-- Apply order: Run after all existing migrations.
-- ============================================================================

-- 1. Add cost columns to offer entities

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS cost_notes TEXT;

ALTER TABLE content_offer_roles
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS cost_notes TEXT;

ALTER TABLE continuity_plans
  ADD COLUMN IF NOT EXISTS cost_per_interval DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS cost_currency TEXT;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2);

ALTER TABLE offer_bundles
  ADD COLUMN IF NOT EXISTS blended_cost_override DECIMAL(10,2);

-- 2. Create cost_events table for usage-based costs (LLM, VAPI, Stripe, etc.)

CREATE TABLE IF NOT EXISTS cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  amount DECIMAL(12,4) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  reference_type TEXT,
  reference_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_events_occurred_source
  ON cost_events (occurred_at, source);

CREATE INDEX IF NOT EXISTS idx_cost_events_occurred_at
  ON cost_events (occurred_at);

-- Idempotency: when reference_type and reference_id are set, prevent duplicate inserts
-- for same (source, reference_type, reference_id, occurred_at)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_events_idempotency
  ON cost_events (source, reference_type, reference_id, occurred_at)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

-- 3. RLS: Admin-only read/write (ingest route uses service role, bypasses RLS)

ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cost_events"
  ON cost_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
