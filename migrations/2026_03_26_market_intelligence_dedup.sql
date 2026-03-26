-- Deduplicate existing rows (keep earliest per source_url)
DELETE FROM market_intelligence
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY created_at ASC) AS rn
    FROM market_intelligence
    WHERE source_url IS NOT NULL AND source_url != ''
  ) sub
  WHERE rn > 1
);

-- Partial unique index: one row per source_url (NULLs and empty strings excluded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_intelligence_source_url_unique
  ON market_intelligence (source_url)
  WHERE source_url IS NOT NULL AND source_url != '';
