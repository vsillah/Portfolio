-- Record which system prompt version was active when the chat session was created.
-- Used by LLM Grader to correlate eval results with prompt iterations.
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS prompt_version INTEGER;

COMMENT ON COLUMN chat_sessions.prompt_version IS 'system_prompts.version at session creation (chatbot or diagnostic key)';
