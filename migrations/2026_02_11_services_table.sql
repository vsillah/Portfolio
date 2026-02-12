-- ============================================================================
-- Migration: Create services table for consulting, warranty, training, etc.
-- Date: 2026-02-11
-- Purpose: Add services content type for admin content management and sales bundles.
-- ============================================================================

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,

  -- Service classification
  service_type TEXT NOT NULL CHECK (service_type IN (
    'training',
    'speaking',
    'consulting',
    'coaching',
    'workshop',
    'warranty'
  )),

  -- Delivery details
  delivery_method TEXT NOT NULL DEFAULT 'virtual' CHECK (delivery_method IN (
    'in_person',
    'virtual',
    'hybrid'
  )),

  -- Duration
  duration_hours DECIMAL(6, 2),
  duration_description TEXT,

  -- Pricing
  price DECIMAL(10, 2),
  is_quote_based BOOLEAN DEFAULT false,

  -- Capacity
  min_participants INTEGER DEFAULT 1,
  max_participants INTEGER,

  -- Content
  prerequisites TEXT,
  deliverables JSONB DEFAULT '[]'::jsonb,
  topics JSONB DEFAULT '[]'::jsonb,

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

CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_services_featured ON services(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_display_order ON services(display_order);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active services" ON services;
CREATE POLICY "Public can view active services"
  ON services FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage services" ON services;
CREATE POLICY "Admins can manage services"
  ON services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

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

-- Update content_offer_roles to include 'service' content type (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'content_offer_roles') THEN
    ALTER TABLE content_offer_roles DROP CONSTRAINT IF EXISTS content_offer_roles_content_type_check;
    ALTER TABLE content_offer_roles
      ADD CONSTRAINT content_offer_roles_content_type_check
      CHECK (content_type IN (
        'product', 'project', 'video', 'publication', 'music',
        'lead_magnet', 'prototype', 'service'
      ));
  END IF;
END $$;

COMMENT ON TABLE services IS 'Service offerings: consulting, training, workshops, warranty, etc. Used as content type in sales bundles and proposals.';
