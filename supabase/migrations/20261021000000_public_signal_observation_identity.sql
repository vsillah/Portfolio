-- One immutable review packet per exact public observation. The identity includes
-- the official coverage identity, source URL, timestamp, values, and denominators.
CREATE UNIQUE INDEX IF NOT EXISTS social_research_public_observation_identity_unique
  ON public.social_content_research_packets ((actor_metadata->'public_signal_observation'->>'observation_identity'))
  WHERE actor_metadata->'public_signal_observation'->>'observation_identity' IS NOT NULL;
