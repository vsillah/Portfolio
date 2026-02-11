-- ============================================================================
-- Run this on your BACKUP database (Supabase SQL Editor or psql).
-- It outputs INSERT statements so you can copy and run them in your current DB.
-- ============================================================================
-- Usage:
--   1. In backup DB: Run OPTION A below. If you get "column does not exist",
--      run OPTION B instead (minimal columns).
--   2. Copy the single result cell (the long string of INSERTs).
--   3. In current DB (Supabase SQL Editor): Paste and Run.
-- ============================================================================

-- OPTION A: Full schema (if backup has parent_bundle_id, bundle_type, default_discount_percent, notes)
SELECT COALESCE(string_agg(
  'INSERT INTO offer_bundles (id, name, description, bundle_items, total_retail_value, total_perceived_value, bundle_price, default_discount_percent, parent_bundle_id, bundle_type, target_funnel_stages, notes, is_active, created_by, created_at, updated_at) VALUES ('
  || quote_nullable(id::text) || '::uuid, '
  || quote_nullable(name) || ', '
  || quote_nullable(description) || ', '
  || quote_nullable(bundle_items::text) || '::jsonb, '
  || quote_nullable(total_retail_value::text) || '::decimal, '
  || quote_nullable(total_perceived_value::text) || '::decimal, '
  || quote_nullable(bundle_price::text) || '::decimal, '
  || quote_nullable(default_discount_percent::text) || '::decimal, '
  || quote_nullable(parent_bundle_id::text) || '::uuid, '
  || quote_nullable(bundle_type) || ', '
  || quote_nullable(target_funnel_stages::text) || '::text[], '
  || quote_nullable(notes) || ', '
  || (CASE WHEN is_active THEN 'true' ELSE 'false' END) || '::boolean, '
  || quote_nullable(created_by::text) || '::uuid, '
  || quote_nullable(created_at::text) || '::timestamptz, '
  || quote_nullable(updated_at::text) || '::timestamptz'
  || ') ON CONFLICT (id) DO NOTHING;',
  E'\n'
), '-- No rows in offer_bundles') AS insert_statements
FROM offer_bundles;

-- OPTION B: Minimal columns (if backup only has base sales schema - no parent_bundle_id, etc.)
-- Uncomment and run this if Option A fails with "column does not exist":
/*
SELECT string_agg(
  'INSERT INTO offer_bundles (id, name, description, bundle_items, total_retail_value, total_perceived_value, bundle_price, target_funnel_stages, is_active, created_by, created_at, updated_at) VALUES ('
  || quote_nullable(id::text) || '::uuid, '
  || quote_nullable(name) || ', '
  || quote_nullable(description) || ', '
  || quote_nullable(bundle_items::text) || '::jsonb, '
  || quote_nullable(total_retail_value::text) || '::decimal, '
  || quote_nullable(total_perceived_value::text) || '::decimal, '
  || quote_nullable(bundle_price::text) || '::decimal, '
  || quote_nullable(target_funnel_stages::text) || '::text[], '
  || (CASE WHEN is_active THEN 'true' ELSE 'false' END) || '::boolean, '
  || quote_nullable(created_by::text) || '::uuid, '
  || quote_nullable(created_at::text) || '::timestamptz, '
  || quote_nullable(updated_at::text) || '::timestamptz'
  || ') ON CONFLICT (id) DO NOTHING;',
  E'\n'
) AS insert_statements
FROM offer_bundles;
*/
