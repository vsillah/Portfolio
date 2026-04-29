-- ============================================================================
-- Stronger Pinecone / grounding copy in email templates + document trace keys
-- Date: 2026-04-29
-- Purpose:
--   1. Replace "one concrete detail" guidance with multi-anchor grounding so
--      drafts use Research / Meeting / RAG / proof sections more fully.
--   2. COMMENT documents new generation_inputs jsonb keys (no CHECK constraint).
-- ============================================================================

UPDATE system_prompts
SET prompt = REPLACE(
  prompt,
  'weave in one concrete detail only if it fits naturally — never force it',
  'ground 2–3 specifics drawn only from the Research brief, Recent meeting context, Social proof, Industry value signal, and the knowledge-base section below; do not invent facts or client names'
),
updated_at = NOW()
WHERE prompt LIKE '%weave in one concrete detail only if it fits naturally — never force it%';

COMMENT ON COLUMN public.outreach_queue.generation_inputs IS
'jsonb trace for in-app draft generation. Core keys: template_key, prompt_version, channel, model, provider, temperature, max_tokens, sequence_step, research_brief_chars, social_proof_chars, meeting_summary_present, meeting_text_source (none|inline_summary|structured_summary|raw_notes|transcript_excerpt), meeting_action_items_chars, pinecone_chars, prior_chat_present, pinecone_block_hash, prior_outreach_*, value_evidence_chars, value_evidence_rows, rag_query_chars, rag_skipped_reason, rag_attempted, rag_error_class, rag_http_status, rag_latency_ms, rag_empty_response.';
