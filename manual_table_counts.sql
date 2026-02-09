-- ============================================================================
-- MANUAL TABLE COUNTS - NO ERRORS VERSION
-- Run each query individually, skip any that error
-- ============================================================================

-- Copy the results from each query and paste into a text file

SELECT 'analytics_events' as table_name, COUNT(*) as row_count FROM analytics_events;

SELECT 'app_prototypes' as table_name, COUNT(*) as row_count FROM app_prototypes;

SELECT 'client_projects' as table_name, COUNT(*) as row_count FROM client_projects;

SELECT 'diagnostic_audits' as table_name, COUNT(*) as row_count FROM diagnostic_audits;

SELECT 'discount_codes' as table_name, COUNT(*) as row_count FROM discount_codes;

SELECT 'downloads' as table_name, COUNT(*) as row_count FROM downloads;

SELECT 'music' as table_name, COUNT(*) as row_count FROM music;

SELECT 'order_items' as table_name, COUNT(*) as row_count FROM order_items;

SELECT 'orders' as table_name, COUNT(*) as row_count FROM orders;

SELECT 'products' as table_name, COUNT(*) as row_count FROM products;

SELECT 'product_links' as table_name, COUNT(*) as row_count FROM product_links;

SELECT 'projects' as table_name, COUNT(*) as row_count FROM projects;

SELECT 'publications' as table_name, COUNT(*) as row_count FROM publications;

SELECT 'referrals' as table_name, COUNT(*) as row_count FROM referrals;

SELECT 'user_profiles' as table_name, COUNT(*) as row_count FROM user_profiles;

SELECT 'videos' as table_name, COUNT(*) as row_count FROM videos;

-- ============================================================================
-- HOW TO USE:
-- ============================================================================
-- Highlight ONE query at a time and run it
-- If it errors with "table does not exist", that's fine - note it as "MISSING"
-- If it succeeds, note the row_count
-- 
-- Create a simple list like:
-- analytics_events: 0
-- app_prototypes: 3
-- product_links: TABLE MISSING  ← Important finding!
-- projects: 3
-- etc.
-- ============================================================================
