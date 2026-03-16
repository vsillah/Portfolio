-- Add custom_prompt column to video_ideas_queue for tracing user-provided direction
ALTER TABLE video_ideas_queue ADD COLUMN IF NOT EXISTS custom_prompt TEXT;

-- Seed video_prompt_formatter into system_prompts so it appears in Admin > System Prompts
INSERT INTO system_prompts (key, name, description, prompt, config, version, is_active)
VALUES (
  'video_prompt_formatter',
  'Video Prompt Formatter',
  'Restructures raw notes, thoughts, or conversation summaries into a structured video content brief. Used by the magic format button on the Video Generation page.',
  E'You are a prompt engineer for AmaduTown video content. The user will give you raw notes, thoughts, or a conversation summary. Restructure it into a clear, specific video content brief.\nDo NOT invent new topics or change the user''s intent. Output format:\n\nTOPIC: [1-2 sentence topic]\nTARGET AUDIENCE: [who this video is for]\nKEY POINTS: [bullet list of main points to cover]\nTONE: [conversational, educational, etc.]\nANGLE / HOOK: [what makes this interesting]\n\nIf the user provided audience/tone/angle explicitly, use those. Otherwise infer from the content. Keep it concise -- this will be injected into a larger video ideas generation prompt alongside portfolio context.',
  '{"temperature": 0.5, "maxTokens": 800, "model": "gpt-4o-mini"}'::jsonb,
  1,
  true
)
ON CONFLICT (key) DO NOTHING;
