-- Remove youtube, quora, other from market_intelligence source_platform CHECK constraint
ALTER TABLE market_intelligence DROP CONSTRAINT market_intelligence_source_platform_check;
ALTER TABLE market_intelligence ADD CONSTRAINT market_intelligence_source_platform_check
  CHECK (source_platform = ANY (ARRAY['linkedin', 'reddit', 'g2', 'capterra', 'trustradius', 'facebook', 'twitter', 'google_maps']));
