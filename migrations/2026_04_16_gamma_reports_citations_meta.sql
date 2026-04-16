-- Adds a citations_meta JSONB column on gamma_reports for post-generation QA.
--
-- The Gamma deck builders (lib/gamma-report-builder.ts) now embed [E#]
-- citation tags inline and append a dedicated "Evidence Ledger" slide.
-- This column stores the canonical EvidenceItem[] that backed the deck so
-- admins can compare what was *intended* to be cited against what Gamma
-- actually rendered.
--
-- Shape:
-- {
--   "items": [
--     { "id": "E1", "kind": "audit_response", "sourceLabel": "...", "verbatim": "...", "meta": { ... } },
--     ...
--   ],
--   "counts": { "audit_response": 4, "meeting_quote": 3, ... },
--   "generatedAt": "2026-04-16T12:00:00Z"
-- }
--
-- Nullable: existing rows retain NULL; new rows can opt in over time as the
-- generation pipeline starts persisting it.

ALTER TABLE gamma_reports
  ADD COLUMN IF NOT EXISTS citations_meta JSONB;

COMMENT ON COLUMN gamma_reports.citations_meta IS
  'Canonical EvidenceItem[] (with counts + timestamp) that backed the deck. Used for post-generation QA to verify [E#] tags and Evidence Ledger slide.';
