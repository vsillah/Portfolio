-- ============================================================================
-- GENERATE EXACT COUNT QUERIES FOR ALL TABLES
-- ============================================================================
-- This query GENERATES the SQL commands to get exact counts
-- Copy the output and run it as a new query
-- ============================================================================

SELECT 
  'SELECT ''' || table_name || ''' as table_name, COUNT(*) as row_count FROM ' || table_name || ' UNION ALL'
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- HOW TO USE:
-- ============================================================================
-- 1. Run this query
-- 2. Copy all the output rows
-- 3. Paste them into a new query
-- 4. Remove the last "UNION ALL" from the final line
-- 5. Add semicolon at the end
-- 6. Run the generated query to get exact counts for ALL tables
-- 
-- The generated query will return one result with all table counts
-- ============================================================================
