-- Stable coverage identity prevents concurrent collector retries from creating
-- duplicate pending packets. Existing ordinary research packets are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS social_research_official_signal_coverage_identity_idx
  ON public.social_content_research_packets ((actor_metadata->'official_signal'->>'coverage_identity'))
  WHERE actor_metadata ? 'official_signal';
