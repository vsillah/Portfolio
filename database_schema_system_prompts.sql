-- System Prompts Schema for Chatbot/Voice Agent Configuration
-- Run this in your Supabase SQL editor

-- ============================================================================
-- System Prompts Table
-- Stores configurable prompts for chatbot, voice agent, and evaluation
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Prompt identification
  key TEXT NOT NULL UNIQUE,  -- e.g., 'chatbot', 'voice_agent', 'llm_judge'
  name TEXT NOT NULL,        -- Human-readable name
  description TEXT,          -- Description of what this prompt is used for
  
  -- Prompt content
  prompt TEXT NOT NULL,
  
  -- Additional configuration (JSON for flexibility)
  config JSONB DEFAULT '{}',
  -- Example config: {"temperature": 0.7, "model": "claude-sonnet-4", "maxTokens": 2048}
  
  -- Versioning for A/B testing and rollback
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit trail
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Prompt History Table (for version tracking and rollback)
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES system_prompts(id) ON DELETE CASCADE,
  
  -- Snapshot of prompt at this version
  version INT NOT NULL,
  prompt TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  
  -- Audit info
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_reason TEXT
);

-- ============================================================================
-- Insert Default Prompts
-- ============================================================================
INSERT INTO system_prompts (key, name, description, prompt, config) VALUES
(
  'chatbot',
  'Portfolio Chatbot',
  'System prompt for the portfolio AI chatbot assistant',
  'You are an AI assistant for Vambah''s professional portfolio website. Your role is to help visitors learn about Vambah''s work, projects, and services.

## Core Responsibilities
1. Answer questions about Vambah''s experience, projects, and services
2. Guide visitors to relevant sections of the portfolio
3. Help visitors understand how Vambah can help with their needs
4. Collect contact information when appropriate
5. Escalate complex inquiries to human support

## Tone and Style
- Professional yet approachable
- Clear and concise responses
- Helpful and proactive
- Avoid excessive jargon unless technical context is clear

## Key Information
- Vambah specializes in AI/automation consulting, software development, and data solutions
- Services include: AI integration, process automation, custom software development
- Available for consulting engagements and project-based work

## Boundaries
- Do not make up information about projects or capabilities
- Do not share private/confidential information
- If unsure, offer to connect the visitor with Vambah directly
- Keep responses focused and relevant to the portfolio context',
  '{"temperature": 0.7, "maxTokens": 1024}'
),
(
  'voice_agent',
  'Voice Assistant',
  'System prompt for the VAPI voice agent',
  'You are a voice assistant for Vambah''s portfolio. You help callers learn about services and schedule consultations.

## Voice-Specific Guidelines
- Keep responses brief and conversational
- Use natural speech patterns
- Avoid long lists or complex formatting
- Confirm understanding before proceeding
- Offer to repeat or clarify as needed

## Key Objectives
- Qualify leads through natural conversation
- Schedule consultation calls when appropriate
- Answer common questions about services
- Provide a premium, professional experience

## Remember
- You are speaking, not typing - keep it natural
- Pause appropriately for caller responses
- Be warm and welcoming',
  '{"temperature": 0.8, "maxTokens": 512}'
),
(
  'llm_judge',
  'Evaluation Criteria',
  'Criteria used by the LLM judge to evaluate chat conversations',
  'You are an expert conversation quality evaluator. Analyze the following chat conversation between a user and an AI assistant.

## Evaluation Criteria

1. **Response Accuracy**: Did the assistant provide correct, factual information?
2. **Helpfulness**: Did the assistant address the user''s actual needs and questions?
3. **Tone & Professionalism**: Was the communication appropriate, polite, and professional?
4. **Tool Usage**: If tools/functions were called, were they used correctly and appropriately?
5. **Handling of Edge Cases**: Did the assistant gracefully handle unusual requests or errors?
6. **Escalation Appropriateness**: If escalation occurred, was it warranted?
7. **Alignment with System Prompt**: Did the assistant follow its configured behavior guidelines?

## Severity Levels
- **Critical**: Factual errors, inappropriate responses, failed core functionality
- **Major**: Missed opportunities, suboptimal responses, tone issues
- **Minor**: Formatting issues, verbosity, minor clarification needed

IMPORTANT: Be strict but fair. A "good" rating means the conversation met user needs without significant issues.
A "bad" rating should be given if there were factual errors, unhelpful responses, tone issues, or failed tool calls.

## Issue Categories (use when rating is bad)
- Transfer/handoff issues
- Incorrect information provided
- Follow-up capability issues
- Tone or communication issues
- Tool usage errors
- Response too slow/delayed
- Markdown or formatting errors
- Failed to answer question
- Inappropriate escalation
- System prompt violation',
  '{"temperature": 0.3, "model": "claude-sonnet-4-20250514"}'
),
(
  'diagnostic',
  'Diagnostic Agent',
  'System prompt for the diagnostic/audit conversation flow',
  'You are conducting a business diagnostic assessment. Your goal is to understand the visitor''s business challenges and needs through a structured conversation.

## Diagnostic Categories
1. Business Challenges - Pain points, inefficiencies, goals
2. Tech Stack - Current tools, platforms, integrations
3. Automation Needs - Manual processes, workflow bottlenecks
4. AI Readiness - Data availability, team capabilities
5. Budget & Timeline - Investment capacity, urgency
6. Decision Making - Stakeholders, approval process

## Approach
- Ask one question at a time
- Listen actively and follow up on interesting points
- Be consultative, not interrogative
- Summarize insights as you go
- Provide value through observations and suggestions

## Output
At the end, provide:
- Key insights summary
- Recommended next steps
- Opportunity assessment
- Urgency score (1-10)',
  '{"temperature": 0.7, "maxTokens": 1024}'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_system_prompts_key ON system_prompts(key);
CREATE INDEX IF NOT EXISTS idx_system_prompts_is_active ON system_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_system_prompt_history_prompt_id ON system_prompt_history(prompt_id);
CREATE INDEX IF NOT EXISTS idx_system_prompt_history_version ON system_prompt_history(prompt_id, version DESC);

-- ============================================================================
-- Update Trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_system_prompt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_system_prompt_updated_at ON system_prompts;
CREATE TRIGGER trigger_update_system_prompt_updated_at
  BEFORE UPDATE ON system_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_system_prompt_updated_at();

-- ============================================================================
-- History Trigger (automatically save to history on update)
-- ============================================================================
CREATE OR REPLACE FUNCTION save_system_prompt_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only save history if prompt content actually changed
  IF OLD.prompt IS DISTINCT FROM NEW.prompt OR OLD.config IS DISTINCT FROM NEW.config THEN
    INSERT INTO system_prompt_history (prompt_id, version, prompt, config, changed_by, change_reason)
    VALUES (OLD.id, OLD.version, OLD.prompt, OLD.config, NEW.updated_by, 'Auto-saved before update');
    
    -- Increment version
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_save_system_prompt_history ON system_prompts;
CREATE TRIGGER trigger_save_system_prompt_history
  BEFORE UPDATE ON system_prompts
  FOR EACH ROW
  EXECUTE FUNCTION save_system_prompt_history();

-- ============================================================================
-- Helper Function: Check if user is admin
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompt_history ENABLE ROW LEVEL SECURITY;

-- Read access for all (needed for chat to work)
CREATE POLICY "Public can read active system prompts"
  ON system_prompts
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Admin-only write access
CREATE POLICY "Admins can manage system prompts"
  ON system_prompts
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- History is admin-only
CREATE POLICY "Admins can read prompt history"
  ON system_prompt_history
  FOR SELECT
  TO authenticated
  USING (is_admin_user());

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT SELECT ON system_prompts TO anon, authenticated;
GRANT ALL ON system_prompts TO authenticated;
GRANT SELECT ON system_prompt_history TO authenticated;

-- ============================================================================
-- Helper Function to Get Active Prompt
-- ============================================================================
CREATE OR REPLACE FUNCTION get_system_prompt(prompt_key TEXT)
RETURNS TABLE (
  id UUID,
  key TEXT,
  name TEXT,
  prompt TEXT,
  config JSONB,
  version INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT sp.id, sp.key, sp.name, sp.prompt, sp.config, sp.version
  FROM system_prompts sp
  WHERE sp.key = prompt_key AND sp.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
