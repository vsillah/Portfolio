-- ============================================================================
-- Migration: Source Validator Phase 1 (industry_benchmarks only)
-- Date: 2026-04-17
-- Purpose: Add validation columns to industry_benchmarks and create shared
--          caches for the VEP Source Validator sub-agent. Phase 1 wires
--          benchmarks only; Phase 2/3 migrations will extend the same
--          columns to pain_point_evidence and market_intelligence.
-- See: .cursor/plans/vep_source_validator_subagent_87250f63.plan.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Validation columns on industry_benchmarks
-- ----------------------------------------------------------------------------
ALTER TABLE industry_benchmarks
  ADD COLUMN IF NOT EXISTS trust_tier smallint
    CHECK (trust_tier BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'validated', 'rejected', 'quarantined')),
  ADD COLUMN IF NOT EXISTS validation_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS methodology_note text,
  ADD COLUMN IF NOT EXISTS triangulation_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS validator_version text,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz;

COMMENT ON COLUMN industry_benchmarks.trust_tier IS
  'Source hierarchy tier (1=gov/regulatory, 2=major analyst, 3=trade/association, 4=reputable press, 5=general web). NULL until validated.';
COMMENT ON COLUMN industry_benchmarks.validation_status IS
  'pending = not yet validated; validated = accepted; rejected = excluded from downstream math; quarantined = needs human review.';
COMMENT ON COLUMN industry_benchmarks.validation_reasons IS
  'JSON array of { code, message, severity } entries produced by the validator.';
COMMENT ON COLUMN industry_benchmarks.methodology_note IS
  'Human-readable source line (source + vintage + adjustments) for use in reports.';
COMMENT ON COLUMN industry_benchmarks.triangulation_refs IS
  'JSON array of corroborating source URLs + titles (populated in Phase 3).';

CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_validation_status
  ON industry_benchmarks(validation_status);

CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_last_validated_at
  ON industry_benchmarks(last_validated_at);

-- ----------------------------------------------------------------------------
-- 2. source_validation_cache: keyed by normalized URL hash
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_validation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash text NOT NULL UNIQUE,         -- sha256 of normalized URL
  url text NOT NULL,
  domain text NOT NULL,                  -- extracted for tier lookups and per-domain throttling
  status_code integer,                   -- HTTP status from last fetch
  final_url text,                        -- after redirects
  title text,
  published_date timestamptz,            -- extracted from meta tags / JSON-LD when possible
  content_length integer,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  ttl_days integer NOT NULL DEFAULT 7,   -- TTL by domain type (gov 30, news 7, blog 3)
  error_reason text                      -- populated when fetch failed
);

CREATE INDEX IF NOT EXISTS idx_source_validation_cache_domain
  ON source_validation_cache(domain);

CREATE INDEX IF NOT EXISTS idx_source_validation_cache_fetched_at
  ON source_validation_cache(fetched_at);

COMMENT ON TABLE source_validation_cache IS
  'Cache of URL fetch results (200/404, title, published_date) used by the VEP Source Validator to avoid re-fetching.';

-- ----------------------------------------------------------------------------
-- 3. source_triangulation_cache: keyed by claim hash (Phase 3 consumer)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_triangulation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_hash text NOT NULL UNIQUE,       -- sha256 of normalized claim string
  claim_excerpt text NOT NULL,           -- raw for debugging
  results jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ url, title, domain, snippet, fetched_at }]
  corroborating_count integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  ttl_days integer NOT NULL DEFAULT 30
);

CREATE INDEX IF NOT EXISTS idx_source_triangulation_cache_fetched_at
  ON source_triangulation_cache(fetched_at);

COMMENT ON TABLE source_triangulation_cache IS
  'Cache of triangulation (web-search corroboration) results keyed by claim hash. Unused in Phase 1; populated in Phase 3.';
