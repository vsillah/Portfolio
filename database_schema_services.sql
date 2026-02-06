-- Services Content Type - Database Schema
-- Supports trainings, speaking engagements, consulting, coaching, and workshops
-- Run this SQL in Supabase SQL Editor

-- ============================================================================
-- Services table - All service offerings
-- ============================================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Service classification
  service_type TEXT NOT NULL CHECK (service_type IN (
    'training',     -- Training programs/courses
    'speaking',     -- Speaking engagements
    'consulting',   -- Consulting/advisory services
    'coaching',     -- One-on-one or group coaching
    'workshop'      -- Hands-on workshops
  )),
  
  -- Delivery details
  delivery_method TEXT NOT NULL DEFAULT 'virtual' CHECK (delivery_method IN (
    'in_person',    -- On-site delivery
    'virtual',      -- Online/remote delivery
    'hybrid'        -- Mix of in-person and virtual
  )),
  
  -- Duration
  duration_hours DECIMAL(6, 2),              -- Session length in hours
  duration_description TEXT,                  -- Human-readable (e.g., "2-day workshop", "6 weekly sessions")
  
  -- Pricing
  price DECIMAL(10, 2),                       -- NULL for quote-based pricing
  is_quote_based BOOLEAN DEFAULT false,       -- If true, price is custom/negotiable
  
  -- Capacity
  min_participants INTEGER DEFAULT 1,
  max_participants INTEGER,                   -- NULL for unlimited
  
  -- Content
  prerequisites TEXT,                         -- What participants need before starting
  deliverables JSONB DEFAULT '[]'::jsonb,    -- What participants receive (e.g., materials, certificates)
  topics JSONB DEFAULT '[]'::jsonb,          -- Topics covered
  
  -- Display
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_services_featured ON services(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_delivery ON services(delivery_method);
CREATE INDEX IF NOT EXISTS idx_services_display_order ON services(display_order);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Public can view active services
DROP POLICY IF EXISTS "Public can view active services" ON services;
CREATE POLICY "Public can view active services"
  ON services FOR SELECT
  USING (is_active = true);

-- Admins can manage all services
DROP POLICY IF EXISTS "Admins can manage services" ON services;
CREATE POLICY "Admins can manage services"
  ON services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS services_updated_at ON services;
CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_services_updated_at();

-- ============================================================================
-- Update content_offer_roles to include 'service' content type
-- ============================================================================
-- Note: This requires dropping and recreating the constraint
-- First, check if the constraint exists and drop it

DO $$
BEGIN
  -- Drop the existing constraint if it exists
  ALTER TABLE content_offer_roles 
    DROP CONSTRAINT IF EXISTS content_offer_roles_content_type_check;
  
  -- Add the new constraint with 'service' included
  ALTER TABLE content_offer_roles
    ADD CONSTRAINT content_offer_roles_content_type_check
    CHECK (content_type IN (
      'product',
      'project',
      'video',
      'publication',
      'music',
      'lead_magnet',
      'prototype',
      'service'
    ));
END $$;

-- ============================================================================
-- Update all_classifiable_content view to include services
-- ============================================================================
CREATE OR REPLACE VIEW all_classifiable_content AS
-- Products
SELECT 
  'product' as content_type,
  id::text as content_id,
  title,
  description,
  type as subtype,
  price,
  image_url,
  is_active,
  display_order,
  created_at
FROM products
WHERE is_active = true

UNION ALL

-- Projects
SELECT 
  'project' as content_type,
  id::text as content_id,
  title,
  description,
  'project' as subtype,
  NULL::decimal as price,
  image as image_url,
  is_published as is_active,
  display_order,
  created_at
FROM projects
WHERE is_published = true

UNION ALL

-- Videos
SELECT 
  'video' as content_type,
  id::text as content_id,
  title,
  description,
  'video' as subtype,
  NULL::decimal as price,
  thumbnail_url as image_url,
  is_published as is_active,
  display_order,
  created_at
FROM videos
WHERE is_published = true

UNION ALL

-- Publications
SELECT 
  'publication' as content_type,
  id::text as content_id,
  title,
  description,
  'publication' as subtype,
  NULL::decimal as price,
  NULL as image_url,
  is_published as is_active,
  display_order,
  created_at
FROM publications
WHERE is_published = true

UNION ALL

-- Music
SELECT 
  'music' as content_type,
  id::text as content_id,
  title,
  description,
  genre as subtype,
  NULL::decimal as price,
  NULL as image_url,
  is_published as is_active,
  display_order,
  created_at
FROM music
WHERE is_published = true

UNION ALL

-- Lead Magnets
SELECT 
  'lead_magnet' as content_type,
  id::text as content_id,
  title,
  description,
  file_type as subtype,
  NULL::decimal as price,
  NULL as image_url,
  is_active,
  0 as display_order,
  created_at
FROM lead_magnets
WHERE is_active = true

UNION ALL

-- Prototypes
SELECT 
  'prototype' as content_type,
  id::text as content_id,
  title,
  description,
  product_type as subtype,
  NULL::decimal as price,
  thumbnail_url as image_url,
  true as is_active,
  0 as display_order,
  created_at
FROM app_prototypes

UNION ALL

-- Services (NEW)
SELECT 
  'service' as content_type,
  id::text as content_id,
  title,
  description,
  service_type as subtype,
  price,
  image_url,
  is_active,
  display_order,
  created_at
FROM services
WHERE is_active = true;

-- ============================================================================
-- Update content_with_offer_roles view (if it exists)
-- ============================================================================
CREATE OR REPLACE VIEW content_with_offer_roles AS
SELECT 
  acc.*,
  cor.id as role_id,
  cor.offer_role,
  cor.dream_outcome_description,
  cor.likelihood_multiplier,
  cor.time_reduction,
  cor.effort_reduction,
  cor.retail_price as role_retail_price,
  cor.offer_price,
  cor.perceived_value,
  cor.bonus_name,
  cor.bonus_description,
  cor.qualifying_actions,
  cor.payout_type,
  cor.display_order as role_display_order,
  cor.is_active as role_is_active
FROM all_classifiable_content acc
LEFT JOIN content_offer_roles cor 
  ON acc.content_type = cor.content_type 
  AND acc.content_id = cor.content_id;

-- ============================================================================
-- Add service_id column to order_items for service purchases
-- ============================================================================
DO $$
BEGIN
  -- Add service_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'service_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE CASCADE;
    
    -- Make product_id nullable since we can now have service orders
    ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
    
    -- Add constraint to ensure either product_id or service_id is set
    ALTER TABLE order_items ADD CONSTRAINT order_items_product_or_service_check
      CHECK (product_id IS NOT NULL OR service_id IS NOT NULL);
  END IF;
END $$;

-- Create index for service_id
CREATE INDEX IF NOT EXISTS idx_order_items_service ON order_items(service_id);

-- ============================================================================
-- Add service_id column to cart_items for service cart items
-- ============================================================================
DO $$
BEGIN
  -- Add service_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cart_items' AND column_name = 'service_id'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE CASCADE;
    
    -- Make product_id nullable since we can now have services in cart
    ALTER TABLE cart_items ALTER COLUMN product_id DROP NOT NULL;
    
    -- Add constraint to ensure either product_id or service_id is set
    ALTER TABLE cart_items ADD CONSTRAINT cart_items_product_or_service_check
      CHECK (product_id IS NOT NULL OR service_id IS NOT NULL);
      
    -- Add unique constraints for services
    -- Note: Using partial unique index pattern for nullable columns
  END IF;
END $$;

-- Create index for service_id in cart_items
CREATE INDEX IF NOT EXISTS idx_cart_items_service ON cart_items(service_id);

-- Unique constraint for user + service combination
DROP INDEX IF EXISTS idx_cart_items_user_service_unique;
CREATE UNIQUE INDEX idx_cart_items_user_service_unique 
  ON cart_items(user_id, service_id) 
  WHERE user_id IS NOT NULL AND service_id IS NOT NULL;

-- Unique constraint for session + service combination  
DROP INDEX IF EXISTS idx_cart_items_session_service_unique;
CREATE UNIQUE INDEX idx_cart_items_session_service_unique 
  ON cart_items(session_id, service_id) 
  WHERE session_id IS NOT NULL AND service_id IS NOT NULL;
