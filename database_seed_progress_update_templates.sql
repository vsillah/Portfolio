-- ============================================================================
-- Seed Data: Progress Update Templates
-- 6 update types with casual, warm tone matching the PDF reference templates.
-- Default templates (content_type = NULL, service_type = NULL) that work
-- for all project/service types. Add content_type/service_type variants later.
-- ============================================================================

-- ============================================================================
-- 1. milestone_completed (casual tone)
-- Standard milestone completion update
-- ============================================================================
INSERT INTO progress_update_templates (
  update_type, content_type, service_type, tone,
  email_subject, email_body, slack_body
) VALUES (
  'milestone_completed', NULL, NULL, 'casual',

  'Progress update on {{project_name}}',

  'Hi {{client_name}}, progress update for you.

Here''s where we''re at:
- Just wrapped up {{completed_milestone}}.
- Next up is {{next_milestone}} (targeting {{next_milestone_date}}).
- {{milestones_progress}}
{{attachment_note}}
{{custom_note}}

Looking forward to delivering this for you.

Thanks,
{{sender_name}}',

  'Hey {{client_name}} -- progress update on *{{project_name}}*:
- Just wrapped up *{{completed_milestone}}'
'
- Next: *{{next_milestone}}* ({{next_milestone_date}})
- {{milestones_progress}}
{{attachment_note}}
{{custom_note}}'
);

-- ============================================================================
-- 2. ahead_of_schedule (celebratory tone)
-- Completed a milestone ahead of schedule -- collect brownie points
-- ============================================================================
INSERT INTO progress_update_templates (
  update_type, content_type, service_type, tone,
  email_subject, email_body, slack_body
) VALUES (
  'ahead_of_schedule', NULL, NULL, 'celebratory',

  'Progress update on {{project_name}} -- ahead of schedule!',

  'Hi {{client_name}},

I know I said I''d deliver a progress update later but we just wrapped {{completed_milestone}} up a little early and I figured I''d collect my brownie points.

- Just finished {{completed_milestone}}
- {{next_milestone}} should be done by {{next_milestone_date}}
- {{milestones_progress}} -- a little bit ahead of schedule, actually!
{{attachment_note}}
{{custom_note}}

If you have any questions just shout.

Thank you!
{{sender_name}}',

  'Hey {{client_name}} -- good news on *{{project_name}}*!
- Just wrapped *{{completed_milestone}}* early
- *{{next_milestone}}* should be done by {{next_milestone_date}}
- {{milestones_progress}} -- ahead of schedule!
{{attachment_note}}
{{custom_note}}'
);

-- ============================================================================
-- 3. on_schedule (casual tone)
-- Regular check-in, everything on track
-- ============================================================================
INSERT INTO progress_update_templates (
  update_type, content_type, service_type, tone,
  email_subject, email_body, slack_body
) VALUES (
  'on_schedule', NULL, NULL, 'casual',

  'Checking in on {{project_name}}',

  'Hi {{client_name}}, just checking in on {{project_name}}.

- {{completed_milestone}} is on schedule. We just wrapped it up and will move on to {{next_milestone}} next.
- Everything looks great so far!
- {{milestones_progress}}
{{attachment_note}}
{{custom_note}}

Hope you''re enjoying the week!

Thanks,
{{sender_name}}',

  'Hey {{client_name}} -- checking in on *{{project_name}}*:
- *{{completed_milestone}}* is done and on schedule
- Moving on to *{{next_milestone}}* next
- {{milestones_progress}}
{{attachment_note}}
{{custom_note}}'
);

-- ============================================================================
-- 4. behind_schedule (professional tone)
-- Transparent update about a delay
-- ============================================================================
INSERT INTO progress_update_templates (
  update_type, content_type, service_type, tone,
  email_subject, email_body, slack_body
) VALUES (
  'behind_schedule', NULL, NULL, 'professional',

  'Update on {{project_name}} -- revised timeline',

  'Hi {{client_name}},

I wanted to give you a transparent update on {{project_name}}.

We''ve completed {{completed_milestone}}, but we''re running slightly behind our original timeline. Here''s the adjusted plan:

- {{completed_milestone}} is now complete
- {{next_milestone}} is our current focus, and we''re targeting {{next_milestone_date}}
- {{milestones_progress}}

I want to make sure we get this right for you, so I''d rather take the time needed than rush through it. If you have any concerns or questions, I''m happy to hop on a quick call.
{{attachment_note}}
{{custom_note}}

Thanks for your patience,
{{sender_name}}',

  'Hey {{client_name}} -- update on *{{project_name}}*:
- *{{completed_milestone}}* is done, but we''re running slightly behind
- Focusing on *{{next_milestone}}* now, targeting {{next_milestone_date}}
- {{milestones_progress}}
- Want to make sure we get this right -- happy to jump on a call if you have any questions.
{{attachment_note}}
{{custom_note}}'
);

-- ============================================================================
-- 5. project_delivery (celebratory tone)
-- Final delivery with artifacts and documentation
-- ============================================================================
INSERT INTO progress_update_templates (
  update_type, content_type, service_type, tone,
  email_subject, email_body, slack_body
) VALUES (
  'project_delivery', NULL, NULL, 'celebratory',

  '{{project_name}} -- delivery & documentation',

  'Hey {{client_name}},

Had a blast working on this -- just wrapped up {{project_name}}.

I always include documentation alongside every delivery, so you and your team know how things work:

{{artifacts_ready}}
{{attachment_note}}
{{custom_note}}

{{warranty_note}}

Would you mind taking a look at this and letting me know your thoughts? Assuming everything is good to go, I''ll send you over an invoice for the remaining balance and we can wrap things up.

PS I have a bunch of interesting ideas for you I''d like to share after we''re done. Let me know if you''d like to hear them.

Thanks,
{{sender_name}}',

  'Hey {{client_name}} -- just wrapped up *{{project_name}}*!

I always include documentation with every delivery:
{{artifacts_ready}}
{{attachment_note}}
{{custom_note}}

{{warranty_note}}

Would you mind taking a look and letting me know your thoughts?'
);

-- ============================================================================
-- 6. warranty_start (professional tone)
-- Warranty period has begun after project delivery
-- ============================================================================
INSERT INTO progress_update_templates (
  update_type, content_type, service_type, tone,
  email_subject, email_body, slack_body
) VALUES (
  'warranty_start', NULL, NULL, 'professional',

  '{{project_name}} -- your warranty period has started',

  'Hi {{client_name}},

Now that {{project_name}} has been delivered and approved, I wanted to confirm that your warranty period is now active.

{{warranty_note}}

During this period, if anything comes up with the delivered solution, just reach out and we''ll take care of it at no additional cost.

Here''s a reminder of what was delivered:
{{artifacts_ready}}

If you have any questions or need support, don''t hesitate to reach out.

Thanks,
{{sender_name}}',

  'Hey {{client_name}} -- your warranty period for *{{project_name}}* is now active.

{{warranty_note}}

If anything comes up with the delivered solution, just reach out and we''ll handle it.

Delivered artifacts:
{{artifacts_ready}}'
);
