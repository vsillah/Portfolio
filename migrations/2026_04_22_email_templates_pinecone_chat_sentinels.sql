-- ============================================================================
-- Migration: email templates — add {{#pinecone_context}} and {{#prior_site_chat}}
--            Mustache-style sentinel blocks
-- Date: 2026-04-22
-- Purpose:
--   Let each email template control WHERE and WHETHER Pinecone RAG (voice of
--   brand) and prior site-chat (visitor → lead continuity) get injected, using
--   the same convention as {{#meeting_action_items}}…{{/meeting_action_items}}
--   and {{#company}}…{{/company}} already in use.
--
--   The generator (lib/email-llm-context.ts) substitutes:
--     - RAG text (from n8n "amadutown-rag-query" Pinecone webhook) for
--       {{pinecone_context}}, stripping the surrounding {{#pinecone_context}}…
--       {{/pinecone_context}} block when RAG is empty/off.
--     - Prior site chat (when EMAIL_RAG_INCLUDE_SITE_CHAT=true and
--       chat_sessions.visitor_email matches the lead) for {{prior_site_chat}},
--       stripping the surrounding block when chat is empty/off.
--
--   When a template does NOT contain these sentinels, the generator still
--   appends default blocks at the end — backward-compatible with any template
--   that has not adopted the sentinel yet.
--
-- Safety: APPEND-only, guarded by NOT LIKE '%{{pinecone_context}}%' so this
--         migration is idempotent (re-running is a no-op).
-- ============================================================================

-- Shared sentinel block. Placed at end of prompt: closer to the instructions
-- than the template header fields, so the model reads your voice / prior chat
-- just before producing the draft.
--
-- Heading copy is intentionally owned by the DB (not hardcoded in lib code) so
-- template authors can adjust wording per template after this migration.

UPDATE system_prompts
SET prompt = prompt || E'\n\n{{#pinecone_context}}\n## Your past work and phrasing (use this to match tone; weave in one concrete detail only if it fits naturally — never force it)\n{{pinecone_context}}\n{{/pinecone_context}}{{#prior_site_chat}}\n\n## Prior site chat with this email address (continuity reference — do not quote verbatim unless it reads naturally)\n{{prior_site_chat}}\n{{/prior_site_chat}}',
    updated_at = NOW()
WHERE key IN (
  'email_cold_outreach',
  'email_asset_delivery',
  'email_follow_up',
  'email_proposal_delivery',
  'email_onboarding_welcome'
)
AND prompt NOT LIKE '%{{pinecone_context}}%';

-- Optional: keep description placeholder list in sync for the templates that
-- list variables. Non-essential; safe to re-run.
UPDATE system_prompts
SET description = description || ' Voice/style: {{pinecone_context}}, {{prior_site_chat}}.'
WHERE key IN (
  'email_cold_outreach',
  'email_asset_delivery',
  'email_follow_up',
  'email_proposal_delivery',
  'email_onboarding_welcome'
)
AND description IS NOT NULL
AND description NOT LIKE '%{{pinecone_context}}%';

-- Verify (manual):
--   SELECT key,
--          (prompt  LIKE '%{{pinecone_context}}%')  AS has_pinecone_sentinel,
--          (prompt  LIKE '%{{prior_site_chat}}%')   AS has_chat_sentinel
--     FROM system_prompts
--    WHERE key IN ('email_cold_outreach','email_asset_delivery','email_follow_up',
--                  'email_proposal_delivery','email_onboarding_welcome')
--    ORDER BY key;
