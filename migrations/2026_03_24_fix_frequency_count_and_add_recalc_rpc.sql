-- ============================================================================
-- Fix frequency_count and avg_monetary_impact staleness
-- ============================================================================
-- The increment_counter RPC was never created, so frequency_count stayed at 0.
-- This function replaces the broken RPC by computing the real count from
-- pain_point_evidence rows, and also keeps avg_monetary_impact in sync.
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_pain_point_stats(p_category_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE pain_point_categories
  SET
    frequency_count = (
      SELECT COUNT(*)
      FROM pain_point_evidence
      WHERE pain_point_category_id = p_category_id
    ),
    avg_monetary_impact = (
      SELECT AVG(monetary_indicator)
      FROM pain_point_evidence
      WHERE pain_point_category_id = p_category_id
        AND monetary_indicator IS NOT NULL
    )
  WHERE id = p_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION refresh_pain_point_stats IS
  'Recomputes frequency_count and avg_monetary_impact on pain_point_categories from actual pain_point_evidence rows. Called after evidence ingest and bulk recalculate.';
