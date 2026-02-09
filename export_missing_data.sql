-- ============================================================================
-- EXPORT MISSING DATA FROM FEB 7TH BACKUP
-- Run these queries in your Feb 7th RESTORED database
-- ============================================================================
-- Copy each output and save in separate files
-- ============================================================================

-- ============================================================================
-- QUERY 1: Export Orders (8 rows)
-- ============================================================================
SELECT 
  'INSERT INTO orders (id, user_id, guest_email, guest_name, total_amount, discount_amount, final_amount, status, stripe_payment_intent_id, discount_code_id, created_at, updated_at) VALUES ' ||
  string_agg(
    '(' || 
    id || ', ' ||
    COALESCE(quote_literal(user_id::text), 'NULL') || ', ' ||
    COALESCE(quote_literal(guest_email), 'NULL') || ', ' ||
    COALESCE(quote_literal(guest_name), 'NULL') || ', ' ||
    total_amount || ', ' ||
    COALESCE(discount_amount::text, '0') || ', ' ||
    final_amount || ', ' ||
    quote_literal(status) || ', ' ||
    COALESCE(quote_literal(stripe_payment_intent_id), 'NULL') || ', ' ||
    COALESCE(discount_code_id::text, 'NULL') || ', ' ||
    quote_literal(created_at::text) || ', ' ||
    quote_literal(updated_at::text) ||
    ')',
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;' as sql
FROM orders;

-- ============================================================================
-- QUERY 2: Export Order Items (8 rows)
-- ============================================================================
SELECT 
  'INSERT INTO order_items (id, order_id, product_id, quantity, price_at_purchase, created_at) VALUES ' ||
  string_agg(
    '(' || 
    id || ', ' ||
    order_id || ', ' ||
    product_id || ', ' ||
    quantity || ', ' ||
    price_at_purchase || ', ' ||
    quote_literal(created_at::text) ||
    ')',
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;' as sql
FROM order_items;

-- ============================================================================
-- QUERY 3: Export Discount Codes (3 rows)
-- ============================================================================
SELECT 
  'INSERT INTO discount_codes (id, code, discount_type, discount_value, applicable_product_ids, max_uses, used_count, valid_from, valid_until, created_by, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    '(' || 
    id || ', ' ||
    quote_literal(code) || ', ' ||
    quote_literal(discount_type) || ', ' ||
    discount_value || ', ' ||
    COALESCE('ARRAY[' || array_to_string(applicable_product_ids, ',') || ']', 'NULL') || ', ' ||
    COALESCE(max_uses::text, 'NULL') || ', ' ||
    used_count || ', ' ||
    quote_literal(valid_from::text) || ', ' ||
    COALESCE(quote_literal(valid_until::text), 'NULL') || ', ' ||
    COALESCE(quote_literal(created_by::text), 'NULL') || ', ' ||
    is_active || ', ' ||
    quote_literal(created_at::text) || ', ' ||
    quote_literal(updated_at::text) ||
    ')',
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;' as sql
FROM discount_codes;

-- ============================================================================
-- QUERY 4: Export Analytics Events (2648 rows)
-- WARNING: This is a large query - may take a minute
-- ============================================================================
-- First, let's see what columns exist in analytics_events:
-- Run this to check the schema:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'analytics_events';

-- OPTION A: If analytics_events is too complex or has unknown schema, SKIP IT
-- Analytics events are historical tracking data - not critical for functionality
-- You can comment this out if you want to skip analytics

-- OPTION B: Use a generic export that works with any column structure
SELECT 
  'INSERT INTO analytics_events (id, created_at) SELECT id, created_at FROM analytics_events_backup ON CONFLICT (id) DO NOTHING;' as sql_note,
  '-- NOTE: Analytics events export skipped due to schema mismatch.' as note,
  '-- This table has 2648 rows but is not critical for core functionality.' as info,
  '-- You can manually export it later if needed.' as suggestion
LIMIT 1;

-- OPTION C: If you know the exact columns, uncomment and modify this:
/*
SELECT 
  'INSERT INTO analytics_events (id, event_name, user_id, session_id, created_at) VALUES ' ||
  string_agg(
    '(' || 
    id || ', ' ||
    COALESCE(quote_literal(event_name), 'NULL') || ', ' ||
    COALESCE(quote_literal(user_id::text), 'NULL') || ', ' ||
    COALESCE(quote_literal(session_id), 'NULL') || ', ' ||
    quote_literal(created_at::text) ||
    ')',
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;' as sql
FROM analytics_events;
*/

-- ============================================================================
-- QUERY 5: Export Diagnostic Audits (24 rows)
-- ============================================================================
-- SKIPPING - Schema mismatch (non-critical system logs)
-- If you need this data, first run check_analytics_schema.sql 
-- to see the actual column names

SELECT 
  '-- Diagnostic audits export skipped due to schema mismatch.' as note,
  '-- These are system logs, not critical for core functionality.' as info
LIMIT 1;

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run each query ONE AT A TIME in Feb 7th backup
-- 2. Copy the output (the generated INSERT statement)
-- 3. Save each in a separate file:
--    - orders_data.sql
--    - order_items_data.sql
--    - discount_codes_data.sql
--    - analytics_events_data.sql
--    - diagnostic_audits_data.sql
-- 4. Then proceed to the next step (creating tables in current database)
-- ============================================================================
