-- ============================================================================
-- STEP 1: LIST ALL TABLES
-- Run this first to see what tables exist
-- ============================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- STEP 2: After seeing the list above, manually count the ones you care about
-- Copy and run these queries ONE AT A TIME (comment out ones that don't exist)
-- ============================================================================

/*
SELECT 'analytics_events' as table_name, COUNT(*) as row_count FROM analytics_events UNION ALL
SELECT 'app_prototypes', COUNT(*) FROM app_prototypes UNION ALL
SELECT 'client_projects', COUNT(*) FROM client_projects UNION ALL
SELECT 'diagnostic_audits', COUNT(*) FROM diagnostic_audits UNION ALL
SELECT 'discount_codes', COUNT(*) FROM discount_codes UNION ALL
SELECT 'downloads', COUNT(*) FROM downloads UNION ALL
SELECT 'music', COUNT(*) FROM music UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items UNION ALL
SELECT 'orders', COUNT(*) FROM orders UNION ALL
SELECT 'products', COUNT(*) FROM products UNION ALL
SELECT 'product_links', COUNT(*) FROM product_links UNION ALL
SELECT 'projects', COUNT(*) FROM projects UNION ALL
SELECT 'publications', COUNT(*) FROM publications UNION ALL
SELECT 'referrals', COUNT(*) FROM referrals UNION ALL
SELECT 'user_profiles', COUNT(*) FROM user_profiles UNION ALL
SELECT 'videos', COUNT(*) FROM videos;
*/

-- Remove the /* and */ above, then delete lines for tables that don't exist
-- (based on Step 1 results)
  
  UNION ALL
  
  SELECT 
    'client_projects' as table_name,
    (SELECT COUNT(*) FROM client_projects) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_projects')
  
  UNION ALL
  
  SELECT 
    'diagnostic_audits' as table_name,
    (SELECT COUNT(*) FROM diagnostic_audits) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'diagnostic_audits')
  
  UNION ALL
  
  SELECT 
    'discount_codes' as table_name,
    (SELECT COUNT(*) FROM discount_codes) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'discount_codes')
  
  UNION ALL
  
  SELECT 
    'downloads' as table_name,
    (SELECT COUNT(*) FROM downloads) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'downloads')
  
  UNION ALL
  
  SELECT 
    'music' as table_name,
    (SELECT COUNT(*) FROM music) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'music')
  
  UNION ALL
  
  SELECT 
    'order_items' as table_name,
    (SELECT COUNT(*) FROM order_items) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items')
  
  UNION ALL
  
  SELECT 
    'orders' as table_name,
    (SELECT COUNT(*) FROM orders) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders')
  
  UNION ALL
  
  SELECT 
    'products' as table_name,
    (SELECT COUNT(*) FROM products) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products')
  
  UNION ALL
  
  SELECT 
    'product_links' as table_name,
    (SELECT COUNT(*) FROM product_links) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_links')
  
  UNION ALL
  
  SELECT 
    'projects' as table_name,
    (SELECT COUNT(*) FROM projects) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects')
  
  UNION ALL
  
  SELECT 
    'publications' as table_name,
    (SELECT COUNT(*) FROM publications) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'publications')
  
  UNION ALL
  
  SELECT 
    'referrals' as table_name,
    (SELECT COUNT(*) FROM referrals) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referrals')
  
  UNION ALL
  
  SELECT 
    'user_profiles' as table_name,
    (SELECT COUNT(*) FROM user_profiles) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles')
  
  UNION ALL
  
  SELECT 
    'videos' as table_name,
    (SELECT COUNT(*) FROM videos) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'videos')
  
  UNION ALL
  
  SELECT 
    'analytics_events' as table_name,
    (SELECT COUNT(*) FROM analytics_events) as row_count
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics_events')
)
SELECT 
  table_name,
  row_count
FROM table_counts
ORDER BY table_name;

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run this in your Feb 7th backup database
-- 2. Click "Export" and download as CSV, or just copy the results
-- 3. Run the same query in your Current database
-- 4. Compare the row_count column for each table
-- 
-- Any table where Feb 7th has MORE rows = data loss
-- ============================================================================
