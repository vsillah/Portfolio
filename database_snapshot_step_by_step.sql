-- ============================================================================
-- DATABASE SNAPSHOT - STEP BY STEP
-- Copy the results from each query and paste into a text file
-- ============================================================================

-- STEP 1: List all tables in your database
-- Copy this result first
SELECT table_name 
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- STEP 2: Count rows in Projects
-- (If table doesn't exist, you'll see an error - that's okay, note "NOT FOUND")
SELECT 'Projects' as table_name, COUNT(*) as row_count FROM projects;

-- STEP 3: Count rows in Music
SELECT 'Music' as table_name, COUNT(*) as row_count FROM music;

-- STEP 4: Count rows in Videos
SELECT 'Videos' as table_name, COUNT(*) as row_count FROM videos;

-- STEP 5: Count rows in Publications
SELECT 'Publications' as table_name, COUNT(*) as row_count FROM publications;

-- STEP 6: Count rows in Products
SELECT 'Products' as table_name, COUNT(*) as row_count FROM products;

-- STEP 7: Count rows in App Prototypes
SELECT 'App Prototypes' as table_name, COUNT(*) as row_count FROM app_prototypes;

-- STEP 8: Count rows in Orders
SELECT 'Orders' as table_name, COUNT(*) as row_count FROM orders;

-- STEP 9: Count rows in Order Items
SELECT 'Order Items' as table_name, COUNT(*) as row_count FROM order_items;

-- STEP 10: Count rows in Client Projects
SELECT 'Client Projects' as table_name, COUNT(*) as row_count FROM client_projects;

-- STEP 11: Count rows in User Profiles
SELECT 'User Profiles' as table_name, COUNT(*) as row_count FROM user_profiles;

-- STEP 12: Count rows in Discount Codes
SELECT 'Discount Codes' as table_name, COUNT(*) as row_count FROM discount_codes;

-- STEP 13: Count rows in Downloads
SELECT 'Downloads' as table_name, COUNT(*) as row_count FROM downloads;

-- STEP 14: Count rows in Referrals
SELECT 'Referrals' as table_name, COUNT(*) as row_count FROM referrals;
