-- ============================================================================
-- Seed Data: Kickoff Agenda Templates
-- Default talk-track templates based on the Kickoff Call SOP PDF.
-- Uses {{tokens}} that get populated with project data at generation time.
-- ============================================================================

-- ============================================================================
-- 1. Default (all service types) — mirrors the original PDF SOP
-- ============================================================================
INSERT INTO kickoff_agenda_templates (
  name, service_type, content_type,
  intro_script, problem_statement, timeline_script,
  availability_script, platform_signup_script, wrapup_script,
  estimated_duration_minutes
) VALUES (
  'Default Kickoff Call SOP',
  NULL, NULL,

  'Hi {{client_name}}, thanks so much for joining today. My name is {{sender_name}} and I''ll be your project lead for this engagement. Before we dive in, I just want to say we''re really excited to get started on {{project_name}} with you.',

  'So the biggest issue in this space is logistics. If you''ve ever worked with another tech consultant or automation specialist, you''ll know that 2FA, passwords, and access management are a nightmare to deal with. We like to sidestep all of that by frontloading an onboarding call — getting signed up and getting access directly on the call. After hundreds of projects, we''ve found it''s the most straightforward way. Sound good?',

  'Here''s our goal over the next {{estimated_duration}} minutes. Our plan is to start {{project_start_date}} and wrap up your project by {{estimated_end_date}} — that''s about {{duration_weeks}} weeks. If we can deliver even earlier, we will.

In terms of milestones, our work is going to be split into the following sections:

{{milestones_summary}}',

  'Most people never talk about availability because of incentives, but it is by far the straightest-line path to a strong working relationship. Here''s how we work: you''ll get one daily update Monday through Friday over {{communication_channel}} where we discuss where the project is at, how things are going, and whether we have any blockers.

If you have any one-off questions, we''ll batch them and answer during that period. Does that work for you?

{{communication_plan_details}}',

  'Now let''s get you signed up for those platforms. We like doing this on a call because it lets us have everything we need by the end of our chat. It also sidesteps two-factor authentication issues which are big in the automation space.

Today, we need:

{{platform_checklist}}

I''ll be right here to walk you through each one. If there are any issues, you can share your screen and I''ll guide you through it. How''s that sound?',

  'That''s it! Got any questions for us before we wrap up?

Here''s what happens next:
- First progress update comes {{first_update_day}}
- You can reach us anytime via {{communication_channel}}
- Your client dashboard is available at {{dashboard_url}}

Looking forward to delivering this for you. Let''s get it!',

  30
);

-- ============================================================================
-- 2. Consulting-specific (longer engagement, more formal)
-- ============================================================================
INSERT INTO kickoff_agenda_templates (
  name, service_type, content_type,
  intro_script, problem_statement, timeline_script,
  availability_script, platform_signup_script, wrapup_script,
  estimated_duration_minutes
) VALUES (
  'Consulting Engagement Kickoff',
  'consulting', 'service',

  'Hi {{client_name}}, thanks for making the time today. I''m {{sender_name}}, your lead consultant for this engagement. I''ve reviewed the proposal and I''m excited about the impact we can make for {{client_company}}.',

  'Before we get into the details, I want to set the right expectation: the number one thing that slows down consulting engagements is access and logistics. Credentials, 2FA codes, platform permissions — they create friction that compounds over weeks. Our approach is to handle all of that upfront, right here on this call, so we can hit the ground running from day one.',

  'Let me walk you through the timeline. We''re planning a {{duration_weeks}}-week engagement starting {{project_start_date}}, with a target completion of {{estimated_end_date}}.

Here''s how we''ve structured the milestones:

{{milestones_summary}}

Each milestone has specific deliverables that we''ll review together. The win conditions we''re targeting:

{{win_conditions_summary}}',

  'Communication is critical for consulting engagements. Here''s our cadence:

{{communication_plan_details}}

We believe in radical transparency — you''ll always know where things stand. If we hit a blocker, you''ll hear about it the same day, not at the next scheduled check-in.',

  'Now let''s handle the access and provisioning. Based on the scope we agreed on, here''s what we need:

{{platform_checklist}}

For each one, I''ll walk you through what we need and why. If anything requires approval from your IT team, we''ll flag it now so there are no surprises later.',

  'Excellent — we''re all set. Quick recap of what happens next:

1. I''ll send you a summary of everything we covered today
2. First progress update arrives {{first_update_day}} via {{communication_channel}}
3. Your personalized client dashboard: {{dashboard_url}}
4. Warranty: {{warranty_summary}}

Any final questions? Looking forward to delivering results for {{client_company}}. Let''s get it!',

  45
);

-- ============================================================================
-- 3. Training/Workshop (shorter, focused on logistics)
-- ============================================================================
INSERT INTO kickoff_agenda_templates (
  name, service_type, content_type,
  intro_script, problem_statement, timeline_script,
  availability_script, platform_signup_script, wrapup_script,
  estimated_duration_minutes
) VALUES (
  'Training & Workshop Kickoff',
  'training', 'service',

  'Hey {{client_name}}! Thanks for hopping on. I''m {{sender_name}} and I''ll be running your training program. Quick call today to make sure we''re set up for success.',

  'The goal of this kickoff is simple: get all the logistics out of the way now so that when training day arrives, we can focus 100% on the content and your team''s learning experience. No scrambling for passwords or access codes mid-session.',

  'Here''s the plan: we''re looking at a {{duration_weeks}}-week program starting {{project_start_date}}.

The training is structured as follows:

{{milestones_summary}}

Each session builds on the last, so the order matters.',

  'For communication during the program:

{{communication_plan_details}}

Between sessions, if your team has questions, they can post them in {{communication_channel}} and we''ll address them at the start of the next session or during office hours.',

  'To make sure the training runs smoothly, I need a few things set up:

{{platform_checklist}}

Most of these are quick — should take us about 10 minutes to get through.',

  'Perfect, we''re all set for {{project_start_date}}!

- Participant list: please send by {{first_update_day}}
- Training materials will be shared 48 hours before each session
- Dashboard for tracking: {{dashboard_url}}

Any questions? Great — see you on training day!',

  20
);
