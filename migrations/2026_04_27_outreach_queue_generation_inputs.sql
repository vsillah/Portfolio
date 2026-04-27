-- ============================================================================
-- Migration: outreach_queue.generation_inputs (Phase 2 — "Why this draft?")
-- Date: 2026-04-27
-- Purpose:
--   Capture the structured set of inputs that produced each in-app outreach
--   draft so admins can answer "why does this email look like this?" without
--   re-running the LLM. Populated by lib/outreach-queue-generator.ts on every
--   insert (email + LinkedIn paths).
--
-- Shape (jsonb, intentionally open — not a strict CHECK so it can evolve):
--   {
--     "template_key":              "email_cold_outreach" | "linkedin_cold_outreach" | ...,
--     "prompt_version":            4,
--     "channel":                   "email" | "linkedin",
--     "model":                     "gpt-4o-mini" | "claude-sonnet-4-20250514" | ...,
--     "provider":                  "openai" | "anthropic",
--     "temperature":               0.75,
--     "max_tokens":                600,
--     "sequence_step":             1,
--     "research_brief_chars":      2400,
--     "social_proof_chars":        820,
--     "meeting_summary_present":   false,
--     "meeting_action_items_chars": 0,
--     "pinecone_chars":            1180,
--     "prior_chat_present":        false,
--     "pinecone_block_hash":       "9b41…"  -- sha256(8) of RAG block, for dedup detection
--   }
--
--   Older drafts (pre-Phase-2 + n8n-generated) will have NULL here; the UI
--   should treat NULL as "trace not recorded".
-- Safety: ADD COLUMN IF NOT EXISTS — re-running on environments that already
--   have the column is a no-op.
-- ============================================================================

ALTER TABLE outreach_queue
  ADD COLUMN IF NOT EXISTS generation_inputs jsonb;

COMMENT ON COLUMN outreach_queue.generation_inputs IS
  'Structured trace of inputs used to generate this draft (Phase 2 traceability).';

-- Index lets us answer "show me drafts produced from email_cold_outreach" or
-- "find every draft using gpt-4o" without scanning the body. Functional indices
-- on the most queried JSON keys keep things cheap.
CREATE INDEX IF NOT EXISTS outreach_queue_generation_inputs_template_idx
  ON outreach_queue ((generation_inputs->>'template_key'));

CREATE INDEX IF NOT EXISTS outreach_queue_generation_inputs_model_idx
  ON outreach_queue ((generation_inputs->>'model'));
