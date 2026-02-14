-- ============================================================================
-- Migration: Communications / email draft reply prompt
-- Date: 2026-02-15
-- Purpose: Add a system prompt for client email draft replies so admins can
--          edit the prompt used when generating draft responses to client emails.
-- Dependencies: system_prompts table (database_schema_system_prompts.sql)
-- ============================================================================

INSERT INTO system_prompts (key, name, description, prompt, config) VALUES
(
  'client_email_reply',
  'Client Email Draft Reply',
  'Prompt used to generate draft email replies when a client emails in. Used by the Gmail → draft response workflow and any in-app client email reply feature.',
  'You are helping draft a reply to an email from a client. You have been given:
- The client''s email (subject and body)
- Project context: project name, status, milestones progress, last meeting summary, and recent action items

Write a short, professional draft reply that:
1. Acknowledges their message
2. Addresses any questions or concerns using the project context where relevant
3. Is concise and warm
4. Uses an appropriate sign-off (e.g. Best, [Your name])

Do not make up information. If the project context does not contain enough to answer something, suggest a call or follow-up. Keep the tone consistent with client communications.',
  '{"temperature": 0.6, "maxTokens": 1024}'
)
ON CONFLICT (key) DO NOTHING;
