-- ============================================================================
-- Migration: Add service support to cart_items and order_items
-- Date: 2026-02-11
-- Prerequisite: services table must exist (2026_02_11_services_table.sql)
-- Purpose: Allow services in cart and orders alongside products.
-- ============================================================================

-- order_items: add service_id, make product_id nullable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'service_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_or_service_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_or_service_check
  CHECK (product_id IS NOT NULL OR service_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_order_items_service ON order_items(service_id) WHERE service_id IS NOT NULL;

-- cart_items: add service_id, make product_id nullable, update unique constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'service_id'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop old unique constraints (PostgreSQL default names from UNIQUE(user_id, product_id) etc.)
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_session_id_product_id_key;

-- Add partial unique constraints: one per (user/session) + (product or service)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_user_product_unique
  ON cart_items(user_id, product_id) WHERE user_id IS NOT NULL AND product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_user_service_unique
  ON cart_items(user_id, service_id) WHERE user_id IS NOT NULL AND service_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_session_product_unique
  ON cart_items(session_id, product_id) WHERE session_id IS NOT NULL AND product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_session_service_unique
  ON cart_items(session_id, service_id) WHERE session_id IS NOT NULL AND service_id IS NOT NULL;

ALTER TABLE cart_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_product_or_service_check;
ALTER TABLE cart_items ADD CONSTRAINT cart_items_product_or_service_check
  CHECK (product_id IS NOT NULL OR service_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_cart_items_service ON cart_items(service_id) WHERE service_id IS NOT NULL;
