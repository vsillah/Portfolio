-- Update email templates to reference stage-appropriate Calendly meeting types.
-- The actual URL is injected server-side via {{calendly_link}} based on the template key.
-- This migration updates the CTA copy to match the meeting type.

-- Asset Delivery: "Delivery and Review" meeting (30 min)
UPDATE system_prompts
SET prompt = replace(
  prompt,
  'I can walk you through the complete analysis in 10 minutes',
  'I can walk you through the complete analysis in a quick 30-minute review'
)
WHERE key = 'email_asset_delivery'
  AND prompt LIKE '%10 minutes%';

-- Follow-Up: Discovery Call (stays as-is, already says "10 minutes")
-- No change needed — discovery call is the right link for follow-ups

-- Proposal Delivery: "Go/No Go Review" meeting
UPDATE system_prompts
SET prompt = replace(
  prompt,
  'Happy to walk through it together',
  'Happy to walk through it together in a review session'
)
WHERE key = 'email_proposal_delivery'
  AND prompt LIKE '%walk through it together%';

-- Onboarding: "Kick Off" meeting
UPDATE system_prompts
SET prompt = replace(
  prompt,
  'Let''s schedule a kickoff call',
  'Let''s schedule your kickoff session'
)
WHERE key = 'email_onboarding_welcome'
  AND prompt LIKE '%kickoff call%';
