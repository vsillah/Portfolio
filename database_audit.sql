-- ============================================================================
-- DATABASE AUDIT SCRIPT
-- Run this in BOTH Supabase projects to compare their state
-- ============================================================================
-- Instructions:
-- 1. Run in your RESTORED project (Feb 7th backup) - save output as "restored_audit.txt"
-- 2. Run in your CURRENT project - save output as "current_audit.txt"
-- 3. Compare the two files to find differences
-- ============================================================================

-- Section 1: All tables with row counts
SELECT 
  'TABLE INVENTORY' as report_section,
  table_name,
  (xpath('/row/c/text()', query_to_xml(format('SELECT COUNT(*) as c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::int as row_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Section 2: Detailed schema for each table
SELECT 
  'TABLE SCHEMAS' as report_section,
  t.table_name,
  string_agg(
    c.column_name || ' (' || c.data_type || 
    CASE WHEN c.character_maximum_length IS NOT NULL 
      THEN '(' || c.character_maximum_length || ')' 
      ELSE '' 
    END || ')',
    ', ' ORDER BY c.ordinal_position
  ) as columns
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

-- Section 3: RLS Policies
SELECT 
  'RLS POLICIES' as report_section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Section 4: Foreign Key Relationships
SELECT
  'FOREIGN KEYS' as report_section,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- Section 5: Indexes
SELECT
  'INDEXES' as report_section,
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Section 6: Sample data counts for key portfolio tables
SELECT 
  'KEY TABLE SAMPLES' as report_section,
  'projects' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN is_published = true THEN 1 END) as published_rows
FROM projects
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects')

UNION ALL

SELECT 
  'KEY TABLE SAMPLES',
  'music',
  COUNT(*),
  COUNT(CASE WHEN is_published = true THEN 1 END)
FROM music
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'music')

UNION ALL

SELECT 
  'KEY TABLE SAMPLES',
  'videos',
  COUNT(*),
  COUNT(CASE WHEN is_published = true THEN 1 END)
FROM videos
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'videos')

UNION ALL

SELECT 
  'KEY TABLE SAMPLES',
  'publications',
  COUNT(*),
  COUNT(CASE WHEN is_published = true THEN 1 END)
FROM publications
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'publications')

UNION ALL

SELECT 
  'KEY TABLE SAMPLES',
  'products',
  COUNT(*),
  COUNT(CASE WHEN is_published = true THEN 1 END)
FROM products
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products')

UNION ALL

SELECT 
  'KEY TABLE SAMPLES',
  'app_prototypes',
  COUNT(*),
  COUNT(*)
FROM app_prototypes
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_prototypes')

UNION ALL

SELECT 
  'KEY TABLE SAMPLES',
  'orders',
  COUNT(*),
  COUNT(*)
FROM orders
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders')

UNION ALL

SELECT 
  'KEY TABLE SAMPLES',
  'client_projects',
  COUNT(*),
  COUNT(*)
FROM client_projects
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_projects');

-- Section 7: User accounts and profiles
SELECT
  'USER PROFILES' as report_section,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_count
FROM user_profiles
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles');

-- Section 8: Recent activity timestamps
SELECT
  'RECENT ACTIVITY' as report_section,
  'Last project update' as activity,
  MAX(updated_at) as timestamp
FROM projects
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects')

UNION ALL

SELECT
  'RECENT ACTIVITY',
  'Last product update',
  MAX(updated_at)
FROM products
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products')

UNION ALL

SELECT
  'RECENT ACTIVITY',
  'Last order',
  MAX(created_at)
FROM orders
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders')

UNION ALL

SELECT
  'RECENT ACTIVITY',
  'Last music update',
  MAX(created_at)
FROM music
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'music');

SELECT '=== AUDIT COMPLETE ===' as status;
