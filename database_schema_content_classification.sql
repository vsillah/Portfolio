-- Content Classification System - Database Schema
-- Allows classifying any content type using Alex Hormozi's offer framework
-- Run this SQL in Supabase SQL Editor

-- ============================================================================
-- Content Offer Roles - Polymorphic classification for all content types
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_offer_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Polymorphic reference to any content type
  content_type TEXT NOT NULL CHECK (content_type IN (
    'product',       -- From products table
    'project',       -- From projects table
    'video',         -- From videos table
    'publication',   -- From publications table
    'music',         -- From music table
    'lead_magnet',   -- From lead_magnets table
    'prototype'      -- From app_prototypes table
  )),
  content_id TEXT NOT NULL,  -- ID from the source table (supports both BIGINT and UUID as text)
  
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
  
  -- Ensure a content item can only have one role at a time
  UNIQUE(content_type, content_id)
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_content_offer_roles_content ON content_offer_roles(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_offer_roles_role ON content_offer_roles(offer_role);
CREATE INDEX IF NOT EXISTS idx_content_offer_roles_active ON content_offer_roles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_content_offer_roles_type ON content_offer_roles(content_type);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE content_offer_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Admins can manage all content offer roles
DROP POLICY IF EXISTS "Admins can manage content offer roles" ON content_offer_roles;
CREATE POLICY "Admins can manage content offer roles"
  ON content_offer_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public can view active content roles (for offer display)
DROP POLICY IF EXISTS "Public can view active content roles" ON content_offer_roles;
CREATE POLICY "Public can view active content roles"
  ON content_offer_roles FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_content_offer_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_offer_roles_updated_at ON content_offer_roles;
CREATE TRIGGER content_offer_roles_updated_at
  BEFORE UPDATE ON content_offer_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_content_offer_roles_updated_at();

-- ============================================================================
-- Migration: Copy existing product_offer_roles to content_offer_roles
-- ============================================================================
-- This will migrate any existing product classifications to the new table
INSERT INTO content_offer_roles (
  content_type,
  content_id,
  offer_role,
  dream_outcome_description,
  likelihood_multiplier,
  time_reduction,
  effort_reduction,
  retail_price,
  offer_price,
  perceived_value,
  bonus_name,
  bonus_description,
  qualifying_actions,
  payout_type,
  display_order,
  is_active,
  created_at,
  updated_at
)
SELECT
  'product' as content_type,
  product_id::text as content_id,
  offer_role,
  dream_outcome_description,
  likelihood_multiplier,
  time_reduction,
  effort_reduction,
  retail_price,
  offer_price,
  perceived_value,
  bonus_name,
  bonus_description,
  qualifying_actions,
  payout_type,
  display_order,
  is_active,
  created_at,
  updated_at
FROM product_offer_roles
ON CONFLICT (content_type, content_id) DO NOTHING;

-- ============================================================================
-- Helper View: All classifiable content
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
  type as subtype,
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
FROM app_prototypes;

-- ============================================================================
-- Helper View: Content with offer roles
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
