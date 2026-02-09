-- ============================================================================
-- COMPLETE TABLE AUDIT - ALL TABLES AND ROW COUNTS
-- This will show EVERY table in your database with exact row counts
-- ============================================================================
-- Run this in BOTH databases and compare the results
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  n_live_tup as estimated_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Note: n_live_tup is an estimate. For EXACT counts, see the query below.
-- The estimates are usually very accurate and much faster.

-- ============================================================================
-- If you need EXACT counts (slower but 100% accurate), use this instead:
-- ============================================================================
-- Copy and paste this entire block into SQL Editor

DO $$
DECLARE
  table_record RECORD;
  row_count BIGINT;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'TABLE NAME | ROW COUNT';
  RAISE NOTICE '============================================';
  
  FOR table_record IN 
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', table_record.table_name) INTO row_count;
    RAISE NOTICE '% | %', RPAD(table_record.table_name, 30), row_count;
  END LOOP;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'AUDIT COMPLETE';
END $$;
