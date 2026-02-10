-- ============================================================================
-- Seed: Create Hunter.io lead source for testing
-- Run this after updating the workflow to use Hunter.io
-- ============================================================================

-- First, update the platform enum to include 'hunter'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cold_lead_sources_platform_check'
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%hunter%'
    ) THEN
        ALTER TABLE cold_lead_sources 
        DROP CONSTRAINT IF EXISTS cold_lead_sources_platform_check;
        
        ALTER TABLE cold_lead_sources 
        ADD CONSTRAINT cold_lead_sources_platform_check 
        CHECK (platform IN ('apollo', 'linkedin', 'google_maps', 'facebook', 'google_contacts', 'hunter'));
    END IF;
END $$;

-- Delete old test source if it exists
DELETE FROM cold_lead_sources 
WHERE name = 'Test Source - SaaS Founders';

-- Create a Hunter.io lead source (25 free searches/month = 5 domains × 5 leads each)
INSERT INTO cold_lead_sources (
  name,
  description,
  platform,
  search_criteria,
  is_active,
  max_leads_per_run,
  run_frequency
) VALUES (
  'Hunter.io - Top SaaS Companies',
  'Target 5 top SaaS companies using Hunter.io domain search (free tier: 25 searches/month)',
  'hunter',
  '{
    "target_domains": [
      "stripe.com",
      "notion.so",
      "linear.app",
      "vercel.com",
      "supabase.com"
    ]
  }'::jsonb,
  true,
  25,
  'manual'
)
ON CONFLICT DO NOTHING
RETURNING id, name, platform, search_criteria, is_active;

-- Verify the insert
SELECT 
  id,
  name,
  platform,
  is_active,
  max_leads_per_run,
  search_criteria,
  created_at
FROM cold_lead_sources
WHERE platform = 'hunter'
ORDER BY created_at DESC;
