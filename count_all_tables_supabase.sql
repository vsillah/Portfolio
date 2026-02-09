-- ============================================================================
-- COUNT ALL TABLES - SUPABASE COMPATIBLE
-- This will show exact row counts for ALL tables
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  cnt BIGINT;
  output_line TEXT;
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'TABLE NAME                    | ROW COUNT';
  RAISE NOTICE '================================================';
  
  FOR rec IN 
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I.%I', 'public', rec.table_name) INTO cnt;
    output_line := RPAD(rec.table_name, 30) || '| ' || cnt;
    RAISE NOTICE '%', output_line;
  END LOOP;
  
  RAISE NOTICE '================================================';
  RAISE NOTICE 'COMPLETE - Check Messages tab above for results';
END $$;

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run this query
-- 2. Click the "Messages" tab (next to Results)
-- 3. You'll see a formatted table with all counts
-- 4. Copy the entire Messages output
-- 5. Run in both Feb 7th and Current databases
-- 6. Compare the counts
-- ============================================================================
