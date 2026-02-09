-- ============================================================================
-- LIST ALL TABLES
-- ============================================================================
-- This just shows you what tables exist in your database
-- Use count_all_tables_supabase.sql to get row counts
-- ============================================================================

SELECT 
  table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- NEXT STEP:
-- Run count_all_tables_supabase.sql to get exact row counts for all tables
-- ============================================================================
