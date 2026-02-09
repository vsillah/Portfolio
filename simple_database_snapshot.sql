-- ============================================================================
-- SIMPLE DATABASE SNAPSHOT
-- Run this single query - it will list all your tables
-- Then manually count rows in the important ones
-- ============================================================================

SELECT 
  table_name as "Table Name",
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name)::regclass)) as "Size"
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- After seeing the table list above, run these manually for each table:
-- SELECT 'projects' as table_name, COUNT(*) FROM projects;
-- SELECT 'music' as table_name, COUNT(*) FROM music;
-- SELECT 'products' as table_name, COUNT(*) FROM products;
-- etc...
