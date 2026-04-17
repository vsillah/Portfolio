-- ============================================================================
-- Migration: Meeting Action Tasks — Contact Attribution + Outreach Integration
-- Date: 2026-04-17
-- Purpose:
--   1. Add durable contact_submission_id FK to meeting_action_tasks (CTO M1 — BIGINT, matches contact_submissions.id).
--   2. Add task_category (S6 — two values: internal | outreach).
--   3. Add outreach_queue_id FK linking a task to a generated draft.
--   4. Add source_task_id FK on outreach_queue to disambiguate task-driven drafts
--      from sequence-driven drafts (CTO M3 — avoids draft-exists collision).
--   5. Backfill contact_submission_id from parent meeting_records.
--   6. Lifecycle trigger (CTO M6): when outreach_queue.status flips to 'sent',
--      auto-complete any meeting_action_tasks linked via outreach_queue_id.
--   7. Update email_follow_up system_prompts entry to reference
--      {{meeting_action_items}} via Mustache-style sentinels so the block
--      vanishes when the contact has no open tasks.
--
-- Dependencies:
--   - meeting_action_tasks (2026_02_14_meeting_action_tasks.sql)
--   - meeting_action_tasks.meeting_record_id nullable (2026_02_15)
--   - outreach_queue (cold lead pipeline migration)
--   - system_prompts (2026_02_15_communications_prompt.sql)
--
-- Rollout note:
--   Backfill UPDATE touches every existing meeting_action_tasks row. This table
--   is NOT in CRITICAL_TABLES in scripts/database-health-check.ts, so no
--   .database-baseline.json rebaseline is required.
--
--   Orphan tasks (meeting_record_id IS NULL) cannot be backfilled by this
--   migration; they require manual attribution via the meeting-tasks UI
--   (see CTO M4 — exposed in Phase 3).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. meeting_action_tasks new columns
-- ────────────────────────────────────────────────────────────────────────────

-- CTO M1: contact_submissions.id is BIGINT across the codebase
-- (see 2026_02_11_sales_lifecycle_and_conversation.sql, 2026_02_09_cold_lead_pipeline.sql).
ALTER TABLE meeting_action_tasks
  ADD COLUMN IF NOT EXISTS contact_submission_id BIGINT
    REFERENCES contact_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mat_contact_submission
  ON meeting_action_tasks(contact_submission_id)
  WHERE contact_submission_id IS NOT NULL;

-- S6: two-value category to disambiguate outreach-worthy tasks. `followup`
-- is deferred until client_update_drafts integration materializes.
ALTER TABLE meeting_action_tasks
  ADD COLUMN IF NOT EXISTS task_category TEXT
    CHECK (task_category IN ('internal', 'outreach'))
    DEFAULT 'internal';

-- Link a task to its generated outreach draft (null until "Send to outreach").
ALTER TABLE meeting_action_tasks
  ADD COLUMN IF NOT EXISTS outreach_queue_id UUID
    REFERENCES outreach_queue(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mat_outreach_queue
  ON meeting_action_tasks(outreach_queue_id)
  WHERE outreach_queue_id IS NOT NULL;

COMMENT ON COLUMN meeting_action_tasks.contact_submission_id IS
  'Durable FK to the contact this task is attributed to. Cascaded from meeting_records on assign-lead; may be set directly for orphan tasks (meeting_record_id IS NULL).';

COMMENT ON COLUMN meeting_action_tasks.task_category IS
  'internal (default) or outreach. Outreach tasks can be sent to the outreach queue via POST /api/meeting-action-tasks/[id]/send-to-outreach.';

COMMENT ON COLUMN meeting_action_tasks.outreach_queue_id IS
  'Set when a task has been pushed to outreach_queue. Lifecycle trigger auto-completes this task when the linked outreach row is marked sent.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. outreach_queue source disambiguation (CTO M3)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE outreach_queue
  ADD COLUMN IF NOT EXISTS source_task_id UUID
    REFERENCES meeting_action_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_queue_source_task
  ON outreach_queue(source_task_id)
  WHERE source_task_id IS NOT NULL;

COMMENT ON COLUMN outreach_queue.source_task_id IS
  'When set, this draft was generated from a meeting_action_task. The draft-exists guard in generateOutreachDraftInApp uses this field to avoid colliding with sequence-driven (source_task_id IS NULL) drafts for the same contact/step.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Backfill contact_submission_id from parent meeting
-- ────────────────────────────────────────────────────────────────────────────

UPDATE meeting_action_tasks t
  SET contact_submission_id = m.contact_submission_id
  FROM meeting_records m
  WHERE t.meeting_record_id = m.id
    AND t.contact_submission_id IS NULL
    AND m.contact_submission_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Lifecycle trigger: outreach sent → task complete (CTO M6)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_task_when_outreach_sent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
    UPDATE meeting_action_tasks
      SET status = 'complete',
          completed_at = NOW()
      WHERE outreach_queue_id = NEW.id
        AND status IN ('pending', 'in_progress');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_complete_task_on_outreach_sent ON outreach_queue;

CREATE TRIGGER trg_complete_task_on_outreach_sent
  AFTER UPDATE OF status ON outreach_queue
  FOR EACH ROW
  EXECUTE FUNCTION complete_task_when_outreach_sent();

COMMENT ON FUNCTION complete_task_when_outreach_sent() IS
  'Auto-completes meeting_action_tasks linked via outreach_queue_id when their draft is marked sent. Reverse direction (task cancelled → cancel draft) remains manual per plan Step 4c.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Upsert email_follow_up system prompt to reference open action items
--    (M5: Mustache-style sentinels so the block vanishes when empty)
--    UPSERT (not UPDATE) because 2026_03_25_saraev_email_templates.sql was
--    not applied to all environments; this guarantees parity.
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO system_prompts (key, name, description, prompt, config)
VALUES (
  'email_follow_up',
  'Follow-Up Email',
  'Saraev 6-step template for following up when a delivery email gets no reply. Variables: {{research_brief}}, {{key_findings}}, {{meeting_action_items}}, {{social_proof}}, {{asset_summary}}, {{sender_name}}, {{company}}, {{calendly_link}}.',
  'You are a business development associate at AmaduTown Advisory Solutions (ATAS). Draft a follow-up email using the 6-step Saraev framework. This prospect received assets from us but hasn''t replied.

## Research Brief
{{research_brief}}

## Key Findings
Surface a DIFFERENT finding than what was likely in the original email. Pick the most surprising or urgent one:
{{key_findings}}
{{#meeting_action_items}}

## Open Action Items (from recent meetings)
Reference at most one of these only if it strengthens the follow-up. Do not list them mechanically.
{{meeting_action_items}}
{{/meeting_action_items}}

## Assets Previously Created
{{asset_summary}}

## Social Proof Reference
{{social_proof}}

## The 6-Step Framework

1. ICEBREAKER: Open casually — "Quick follow-up" or "One more thing from the analysis I ran for {{company}}." Reference a DIFFERENT finding than what was likely in the first email. Do NOT guilt-trip or mention they haven''t replied.

2. VALUE PROPOSITION: Surface one new compelling insight. Frame it as something they might find useful even if they''re not ready to engage. One sentence.

3. SOCIAL PROOF: Use a DIFFERENT proof point than the original delivery. One sentence, specific numbers.

4. RISK REVERSAL: "Totally on your timeline — just thought this was worth flagging."

5. CTA: "Worth 10 minutes this week? {{calendly_link}}" Direct Calendly link. Low-commitment.

6. CLOSE: Sign off as {{sender_name}} only. Casual and human.

## Rules
- Under 100 words — shorter than the original email
- NO links to reports or dashboards (only the Calendly link)
- Do NOT restate everything from the first email
- Do NOT sound desperate or passive-aggressive
- One new angle, one new proof point, one soft ask

Respond with JSON: { "subject": "...", "body": "..." }
The body should be plain text with line breaks (not HTML).',
  '{}'::jsonb
)
ON CONFLICT (key) DO UPDATE
  SET prompt = EXCLUDED.prompt,
      description = EXCLUDED.description,
      updated_at = NOW();

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Verification hint (manual, post-apply):
--    SELECT column_name, data_type FROM information_schema.columns
--      WHERE table_name='meeting_action_tasks'
--      AND column_name IN ('contact_submission_id','task_category','outreach_queue_id');
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint
--      WHERE conrelid='meeting_action_tasks'::regclass AND conname ILIKE '%task_category%';
--    SELECT tgname FROM pg_trigger WHERE tgname='trg_complete_task_on_outreach_sent';
-- ────────────────────────────────────────────────────────────────────────────
