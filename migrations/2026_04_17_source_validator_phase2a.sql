-- VEP Source Validator — Phase 2a
-- Adds LLM "excerpt faithfulness" judge columns to pain_point_evidence.
-- Decision gates documented in CTO review (2026-04-17):
--   * Two independent status dimensions (source vs excerpt), not collapsed.
--   * Short-circuit LLM call when parent source is rejected.
--   * prompt_version tracked so re-judging after prompt changes is idempotent.
--   * validation_error kept separate from status so LLM failures don't poison
--     the verdict column (status stays 'pending', error populated).
--
-- Downstream contract: a row is usable by calculations/reports iff
--   source_validation_status ∈ ('validated','quarantined')
--   AND excerpt_faithfulness_status = 'faithful'
-- (both conditions enforced via applyValidatedEvidenceFilter() helper).

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS source_validation_status TEXT
    CHECK (source_validation_status IN ('pending','validated','quarantined','rejected'))
    DEFAULT 'pending';

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS excerpt_faithfulness_status TEXT
    CHECK (excerpt_faithfulness_status IN ('pending','faithful','unfaithful','insufficient'))
    DEFAULT 'pending';

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS excerpt_faithfulness_reason TEXT;

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS excerpt_faithfulness_confidence DECIMAL(4,3)
    CHECK (excerpt_faithfulness_confidence IS NULL
           OR (excerpt_faithfulness_confidence >= 0 AND excerpt_faithfulness_confidence <= 1));

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS excerpt_supported TEXT
    CHECK (excerpt_supported IS NULL OR excerpt_supported IN ('yes','no'));

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS excerpt_quantified TEXT
    CHECK (excerpt_quantified IS NULL OR excerpt_quantified IN ('yes','no','approximate','not_applicable'));

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS prompt_version TEXT;

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS validator_version TEXT;

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS validation_error TEXT;

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

-- Indexes for the batch runner's "stale + pending" scan.
CREATE INDEX IF NOT EXISTS idx_ppe_excerpt_status
  ON pain_point_evidence (excerpt_faithfulness_status);
CREATE INDEX IF NOT EXISTS idx_ppe_source_status
  ON pain_point_evidence (source_validation_status);
CREATE INDEX IF NOT EXISTS idx_ppe_last_validated
  ON pain_point_evidence (last_validated_at NULLS FIRST);

-- Run log table — minimal observability, per-run counts + cost.
-- Phase 2a populates it manually from the API route; Phase 2b will add cron.
CREATE TABLE IF NOT EXISTS source_validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  mode TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  prompt_version TEXT,
  attempted INTEGER NOT NULL DEFAULT 0,
  validated INTEGER NOT NULL DEFAULT 0,
  rejected INTEGER NOT NULL DEFAULT 0,
  quarantined INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  faithful INTEGER,
  unfaithful INTEGER,
  insufficient INTEGER,
  llm_tokens_in INTEGER,
  llm_tokens_out INTEGER,
  llm_cost_usd DECIMAL(10,6),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  triggered_by TEXT,  -- user id or 'cron'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_svr_table_created ON source_validation_runs (table_name, created_at DESC);
