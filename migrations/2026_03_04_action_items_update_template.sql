-- Extend progress_update_templates to support action_items_update type.
-- This centralizes the status report email/Slack copy that was previously
-- hardcoded in lib/client-update-drafts.ts renderStatusReportEmail().

-- 1. Widen the update_type CHECK on progress_update_templates
ALTER TABLE progress_update_templates
  DROP CONSTRAINT IF EXISTS progress_update_templates_update_type_check;

ALTER TABLE progress_update_templates
  ADD CONSTRAINT progress_update_templates_update_type_check
    CHECK (update_type IN (
      'milestone_completed',
      'ahead_of_schedule',
      'on_schedule',
      'behind_schedule',
      'project_delivery',
      'warranty_start',
      'action_items_update'
    ));

-- 2. Widen the update_type CHECK on progress_update_log (so logs can reference the new type)
ALTER TABLE progress_update_log
  DROP CONSTRAINT IF EXISTS progress_update_log_update_type_check;

ALTER TABLE progress_update_log
  ADD CONSTRAINT progress_update_log_update_type_check
    CHECK (update_type IN (
      'milestone_completed',
      'ahead_of_schedule',
      'on_schedule',
      'behind_schedule',
      'project_delivery',
      'warranty_start',
      'action_items_update'
    ));

-- 3. Seed the default action_items_update template
-- Placeholders: {{first_name}}, {{task_list_html}}, {{task_list_mrkdwn}},
--   {{completed_count}}, {{total_count}}, {{estimated_completion}},
--   {{custom_note}}, {{sign_off_name}}
INSERT INTO progress_update_templates (
  update_type, content_type, service_type, tone,
  email_subject, email_body, slack_body, is_active
) VALUES (
  'action_items_update', NULL, NULL, 'casual',

  -- email_subject
  'Status on action items from our prior meetings',

  -- email_body (HTML with {{token}} placeholders)
  '<p>Hey {{first_name}},</p>
<p>Hope all is well. Here''s a status on the action items from our prior meetings.</p>
<p>Progress: {{completed_count}} of {{total_count}} items complete.{{estimated_completion}}</p>
<ul>
{{task_list_html}}
</ul>
{{custom_note}}
<p>Let me know if you have any questions or if priorities have changed.</p>
<p>{{sign_off_name}}</p>',

  -- slack_body (Slack mrkdwn with {{token}} placeholders)
  'Hey {{first_name}},

Hope all is well. Here''s a status on the action items from our prior meetings.

*Progress:* {{completed_count}} of {{total_count}} items complete.{{estimated_completion}}

{{task_list_mrkdwn}}
{{custom_note}}
Let me know if you have any questions or if priorities have changed.

{{sign_off_name}}',

  true
)
ON CONFLICT DO NOTHING;

-- 4. Add slack_body column to client_update_drafts so we can store the
--    Slack-formatted version alongside the HTML email body.
ALTER TABLE client_update_drafts
  ADD COLUMN IF NOT EXISTS slack_body TEXT;
