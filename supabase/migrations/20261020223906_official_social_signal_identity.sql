-- Concurrent retries retain one research packet per discovered release.
CREATE UNIQUE INDEX IF NOT EXISTS social_research_official_signal_coverage_identity_idx
  ON public.social_content_research_packets ((actor_metadata->'official_signal'->>'coverage_identity'))
  WHERE actor_metadata ? 'official_signal';
