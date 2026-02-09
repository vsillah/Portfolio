-- ============================================================================
-- QUICK DATABASE COMPARISON
-- Simplified audit focusing on key differences
-- ============================================================================
-- Run in BOTH projects and compare outputs side-by-side
-- ============================================================================

-- Show all tables and their row counts in a simple format
WITH table_counts AS (
  SELECT 
    table_name,
    (xpath('/row/c/text()', query_to_xml(format('SELECT COUNT(*) as c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::int as row_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
)
SELECT 
  table_name || ': ' || row_count || ' rows' as summary
FROM table_counts
ORDER BY table_name;

-- Show key portfolio/store data counts (simplified - just row counts)
SELECT '---' as divider;
SELECT 'KEY DATA SUMMARY:' as heading;

-- Just count rows for each table if it exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects')
    THEN (SELECT 'Projects: ' || COUNT(*) || ' total' FROM projects)
    ELSE 'Projects: TABLE NOT FOUND'
  END as data

UNION ALL

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'music')
    THEN (SELECT 'Music: ' || COUNT(*) || ' total' FROM music)
    ELSE 'Music: TABLE NOT FOUND'
  END

UNION ALL

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'videos')
    THEN (SELECT 'Videos: ' || COUNT(*) || ' total' FROM videos)
    ELSE 'Videos: TABLE NOT FOUND'
  END

UNION ALL

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'publications')
    THEN (SELECT 'Publications: ' || COUNT(*) || ' total' FROM publications)
    ELSE 'Publications: TABLE NOT FOUND'
  END

UNION ALL

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products')
    THEN (SELECT 'Products: ' || COUNT(*) || ' total' FROM products)
    ELSE 'Products: TABLE NOT FOUND'
  END

UNION ALL

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_prototypes')
    THEN (SELECT 'App Prototypes: ' || COUNT(*) || ' total' FROM app_prototypes)
    ELSE 'App Prototypes: TABLE NOT FOUND'
  END

UNION ALL

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders')
    THEN (SELECT 'Orders: ' || COUNT(*) || ' total' FROM orders)
    ELSE 'Orders: TABLE NOT FOUND'
  END

UNION ALL

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_projects')
    THEN (SELECT 'Client Projects: ' || COUNT(*) || ' total' FROM client_projects)
    ELSE 'Client Projects: TABLE NOT FOUND'
  END

UNION ALL

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles')
    THEN (SELECT 'User Profiles: ' || COUNT(*) || ' total' FROM user_profiles)
    ELSE 'User Profiles: TABLE NOT FOUND'
  END;

SELECT '---' as divider;
SELECT 'COMPARISON COMPLETE' as status;
