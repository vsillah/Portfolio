-- ============================================================================
-- CHECK ANALYTICS_EVENTS SCHEMA
-- Run this in your Feb 7th backup to see what columns exist
-- ============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'analytics_events'
ORDER BY ordinal_position;

-- After running this, you'll see the actual column names
-- Then you can update the analytics export query in export_missing_data.sql
-- to use the correct column names

-- ============================================================================
-- SAMPLE ROW (to see actual data)
-- ============================================================================
SELECT * FROM analytics_events LIMIT 1;
