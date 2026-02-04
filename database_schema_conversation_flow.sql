-- Database Schema Update: Conversation Flow Tracking
-- Run this SQL in Supabase SQL Editor
-- Adds dynamic conversation tracking to sales sessions

-- ============================================================================
-- Add conversation_flow column to sales_sessions
-- ============================================================================

-- Add the conversation_flow JSONB column to track real-time responses
ALTER TABLE sales_sessions 
ADD COLUMN IF NOT EXISTS conversation_flow JSONB DEFAULT '[]';

-- Comment for documentation
COMMENT ON COLUMN sales_sessions.conversation_flow IS 
'Tracks real-time client responses during sales calls. Structure: 
[{
  id: string,           -- Unique response ID
  stepId: string,       -- Script step ID when response occurred
  responseType: string, -- positive|price_objection|timing_objection|authority_objection|feature_concern|past_failure|diy|competitor|neutral
  notes: string?,       -- Optional agent notes
  timestamp: string,    -- ISO timestamp
  offerPresented: string?, -- What offer was being presented
  strategyChosen: string?, -- What strategy the agent chose
  aiRecommendations: [{    -- AI suggestions at this point
    strategy: string,
    offerRole: string,
    products: [{ id, name, reason }],
    confidence: number,
    talkingPoint: string,
    why: string
  }]
}]';

-- Add index for querying conversation flow
CREATE INDEX IF NOT EXISTS idx_sales_sessions_conversation_flow 
ON sales_sessions USING GIN (conversation_flow);

-- ============================================================================
-- Update the sales_sessions view to include conversation metrics
-- ============================================================================

-- Create a view for conversation analytics
CREATE OR REPLACE VIEW sales_session_analytics AS
SELECT 
  ss.id,
  ss.diagnostic_audit_id,
  ss.client_name,
  ss.client_company,
  ss.funnel_stage,
  ss.outcome,
  ss.created_at,
  ss.updated_at,
  -- Conversation metrics
  jsonb_array_length(ss.conversation_flow) as total_responses,
  (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(ss.conversation_flow) elem 
    WHERE elem->>'responseType' = 'positive'
  ) as positive_responses,
  (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(ss.conversation_flow) elem 
    WHERE elem->>'responseType' LIKE '%objection'
  ) as objection_count,
  -- Most recent response
  ss.conversation_flow->-1->>'responseType' as last_response_type,
  ss.conversation_flow->-1->>'strategyChosen' as last_strategy_used
FROM sales_sessions ss;

-- Grant permissions
GRANT SELECT ON sales_session_analytics TO authenticated;
