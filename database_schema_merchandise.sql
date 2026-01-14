-- Print-on-Demand Merchandise Platform - Database Schema
-- Run this SQL in Supabase SQL Editor after running database_schema_store.sql

-- Extend products table with merchandise-specific fields
DO $$
BEGIN
  -- Add printful_product_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'printful_product_id'
  ) THEN
    ALTER TABLE products ADD COLUMN printful_product_id INTEGER;
  END IF;

  -- Add printful_variant_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'printful_variant_id'
  ) THEN
    ALTER TABLE products ADD COLUMN printful_variant_id INTEGER;
  END IF;

  -- Add category if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'category'
  ) THEN
    ALTER TABLE products ADD COLUMN category TEXT;
  END IF;

  -- Add base_cost if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'base_cost'
  ) THEN
    ALTER TABLE products ADD COLUMN base_cost DECIMAL(10, 2);
  END IF;

  -- Add markup_percentage if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'markup_percentage'
  ) THEN
    ALTER TABLE products ADD COLUMN markup_percentage DECIMAL(5, 2) DEFAULT 50.00;
  END IF;

  -- Add is_print_on_demand if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'is_print_on_demand'
  ) THEN
    ALTER TABLE products ADD COLUMN is_print_on_demand BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  printful_variant_id INTEGER NOT NULL,
  size TEXT,
  color TEXT NOT NULL,
  color_code TEXT,
  sku TEXT,
  price DECIMAL(10, 2) NOT NULL,
  is_available BOOLEAN DEFAULT true,
  mockup_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique variant per product
  UNIQUE(product_id, printful_variant_id)
);

-- Extend orders table with Printful fulfillment fields
DO $$
BEGIN
  -- Add printful_order_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'printful_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN printful_order_id INTEGER;
  END IF;

  -- Add shipping_address if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_address JSONB;
  END IF;

  -- Add shipping_cost if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'shipping_cost'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_cost DECIMAL(10, 2) DEFAULT 0;
  END IF;

  -- Add tax if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'tax'
  ) THEN
    ALTER TABLE orders ADD COLUMN tax DECIMAL(10, 2) DEFAULT 0;
  END IF;

  -- Add tracking_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN tracking_number TEXT;
  END IF;

  -- Add estimated_delivery if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'estimated_delivery'
  ) THEN
    ALTER TABLE orders ADD COLUMN estimated_delivery DATE;
  END IF;

  -- Add fulfillment_status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'fulfillment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN fulfillment_status TEXT DEFAULT 'pending' 
      CHECK (fulfillment_status IN ('pending', 'processing', 'fulfilled', 'shipped', 'delivered', 'cancelled'));
  END IF;
END $$;

-- Extend order_items table
DO $$
BEGIN
  -- Add product_variant_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'product_variant_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN product_variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL;
  END IF;

  -- Add printful_variant_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'printful_variant_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN printful_variant_id INTEGER;
  END IF;
END $$;

-- Create printful_sync_log table (optional, for tracking sync operations)
CREATE TABLE IF NOT EXISTS printful_sync_log (
  id BIGSERIAL PRIMARY KEY,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_printful ON products(printful_product_id) WHERE printful_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_pod ON products(is_print_on_demand) WHERE is_print_on_demand = true;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_printful ON product_variants(printful_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_available ON product_variants(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_orders_printful ON orders(printful_order_id) WHERE printful_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(product_variant_id) WHERE product_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_printful_sync_log_created ON printful_sync_log(created_at DESC);

-- Enable RLS on new tables
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE printful_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_variants
DROP POLICY IF EXISTS "Public can view available variants" ON product_variants;
CREATE POLICY "Public can view available variants"
  ON product_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
      AND products.is_active = true
      AND product_variants.is_available = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage variants" ON product_variants;
CREATE POLICY "Admins can manage variants"
  ON product_variants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for printful_sync_log
DROP POLICY IF EXISTS "Admins can view sync logs" ON printful_sync_log;
CREATE POLICY "Admins can view sync logs"
  ON printful_sync_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp for product_variants
CREATE OR REPLACE FUNCTION update_product_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for product_variants updated_at
DROP TRIGGER IF EXISTS product_variants_updated_at ON product_variants;
CREATE TRIGGER product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_variants_updated_at();

-- Add constraint for category values (optional, for data integrity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_category_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_category_check 
      CHECK (category IS NULL OR category IN ('apparel', 'houseware', 'travel', 'office'));
  END IF;
END $$;
