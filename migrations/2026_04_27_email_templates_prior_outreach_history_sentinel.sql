-- ============================================================================
-- Migration: outreach templates — add {{#prior_outreach_history}} sentinel
-- Date: 2026-04-27
-- Purpose:
--   Phase 3 of the outreach generator unification (Hormozi/Saraev voice +
--   continuity). Lets each email + LinkedIn template control WHERE prior
--   correspondence history with the lead gets injected. The generator
--   (lib/outreach-queue-generator.ts → lib/lead-correspondence-context.ts)
--   loads the lead's recent sent / replied / inbound messages from
--   outreach_queue + contact_communications, renders a compact, capped block,
--   and substitutes it for {{prior_outreach_history}} (or strips the wrapped
--   {{#prior_outreach_history}}…{{/prior_outreach_history}} block when empty).
--
--   Backward-compat: when a template does NOT contain this sentinel, the
--   generator still appends a default heading + block at the end of the
--   prompt. So this migration is purely a positioning hint — it lets the
--   template author choose where the history slots in (we put it just AFTER
--   {{social_proof}} / {{research_brief}} so the model reads the lead facts
--   first, then the conversation memory).
--
-- Safety: APPEND-only, idempotent — guarded by NOT LIKE so re-running is a
--         no-op. Mirrors the pattern of
--         migrations/2026_04_22_email_templates_pinecone_chat_sentinels.sql.
-- ============================================================================

-- The sentinel block. Heading copy lives in the DB so per-template tuning is
-- possible after this seed. Goes near the end of the prompt, after RAG/chat
-- but before the final emit-JSON instructions: the model has already absorbed
-- voice + lead facts and now sees the running conversation just before
-- drafting.

UPDATE system_prompts
SET prompt = prompt || E'\n\n{{#prior_outreach_history}}\n## Prior outreach history with this lead\n{{prior_outreach_history}}\n\nDo not repeat anything you already sent. If the lead replied, reference their reply naturally. Maintain continuity of voice across the thread.\n{{/prior_outreach_history}}',
    updated_at = NOW()
WHERE key IN (
  'email_cold_outreach',
  'email_asset_delivery',
  'email_follow_up',
  'email_proposal_delivery',
  'email_onboarding_welcome',
  'linkedin_cold_outreach'
)
AND prompt NOT LIKE '%{{prior_outreach_history}}%';

-- Optional: keep description placeholder list in sync for templates that list
-- variables. Non-essential; safe to re-run.
UPDATE system_prompts
SET description = description || ' Continuity: {{prior_outreach_history}}.'
WHERE key IN (
  'email_cold_outreach',
  'email_asset_delivery',
  'email_follow_up',
  'email_proposal_delivery',
  'email_onboarding_welcome',
  'linkedin_cold_outreach'
)
AND description IS NOT NULL
AND description NOT LIKE '%{{prior_outreach_history}}%';

-- Verify (manual):
--   SELECT key,
--          (prompt LIKE '%{{prior_outreach_history}}%') AS has_prior_outreach_sentinel
--     FROM system_prompts
--    WHERE key IN ('email_cold_outreach','email_asset_delivery','email_follow_up',
--                  'email_proposal_delivery','email_onboarding_welcome',
--                  'linkedin_cold_outreach')
--    ORDER BY key;
