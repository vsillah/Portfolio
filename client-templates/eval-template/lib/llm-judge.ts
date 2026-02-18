/**
 * LLM-as-a-Judge Evaluation Service
 * Uses an LLM to evaluate chat conversations for quality assessment
 * Supports multiple providers (Claude, OpenAI) for A/B testing
 */

export interface ChatMessageForJudge {
  role: 'user' | 'assistant' | 'support'
  content: string
  timestamp?: string
  metadata?: {
    isToolCall?: boolean
    toolCall?: {
      name: string
      arguments: any
      response: any
      success: boolean
    }
  }
}

export interface JudgeContext {
  systemPrompt?: string
  visitorName?: string
  visitorEmail?: string
  isEscalated?: boolean
  channel: 'text' | 'voice'
  totalMessages: number
}

export interface JudgeEvaluation {
  rating: 'good' | 'bad'
  reasoning: string
  confidence: number
  categories: string[]
  suggestions?: string[]
}

export type LLMProvider = 'anthropic' | 'openai'

export interface JudgeConfig {
  provider: LLMProvider
  model: string
  promptVersion: string
  temperature?: number
}

// Available models for each provider
export const AVAILABLE_MODELS: Record<LLMProvider, Array<{ id: string; name: string; description: string }>> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best balance of speed and quality' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and cost-effective' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable OpenAI model' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective' },
  ],
}

// Default configuration
export const DEFAULT_JUDGE_CONFIG: JudgeConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  promptVersion: 'v1',
  temperature: 0.3,
}

// Evaluation criteria prompt
const EVALUATION_CRITERIA = `You are an expert conversation quality evaluator. Analyze the following chat conversation between a user and an AI assistant.

Evaluate the conversation based on these criteria:

1. **Response Accuracy**: Did the assistant provide correct, factual information?
2. **Helpfulness**: Did the assistant address the user's actual needs and questions?
3. **Tone & Professionalism**: Was the communication appropriate, polite, and professional?
4. **Tool Usage**: If tools/functions were called, were they used correctly and appropriately?
5. **Handling of Edge Cases**: Did the assistant gracefully handle unusual requests or errors?
6. **Escalation Appropriateness**: If escalation occurred, was it warranted?

IMPORTANT: Be strict but fair. A "good" rating means the conversation met user needs without significant issues.
A "bad" rating should be given if there were factual errors, unhelpful responses, tone issues, or failed tool calls.

Provide your evaluation in the following JSON format:
{
  "rating": "good" or "bad",
  "reasoning": "Brief explanation of your evaluation (2-3 sentences)",
  "confidence": 0.0 to 1.0 (how confident you are in this assessment),
  "categories": ["array of issue categories if rating is bad, empty if good"],
  "suggestions": ["optional array of improvement suggestions"]
}

Issue categories to use (if applicable):
- "Transfer/handoff issues"
- "Incorrect information provided"
- "Follow-up capability issues"
- "Tone or communication issues"
- "Tool usage errors"
- "Response too slow/delayed"
- "Markdown or formatting errors"
- "Failed to answer question"
- "Inappropriate escalation"
- "System prompt violation"`

/**
 * Build the prompt for the LLM judge
 */
export function buildJudgePrompt(
  messages: ChatMessageForJudge[],
  context: JudgeContext
): string {
  let prompt = EVALUATION_CRITERIA + '\n\n'
  
  // Add system prompt for context
  if (context.systemPrompt) {
    prompt += '## Chatbot System Prompt (for reference)\n'
    prompt += 'The assistant was configured with the following system prompt:\n\n'
    prompt += '```\n' + context.systemPrompt.substring(0, 2000) + '\n```\n\n'
  }
  
  // Add context
  prompt += '## Conversation Context\n'
  prompt += `- Channel: ${context.channel}\n`
  prompt += `- Total messages: ${context.totalMessages}\n`
  if (context.visitorName) prompt += `- Visitor name: ${context.visitorName}\n`
  if (context.isEscalated) prompt += `- Escalated to human: Yes\n`
  prompt += '\n'
  
  // Add conversation
  prompt += '## Conversation\n\n'
  
  for (const msg of messages) {
    const role = msg.role === 'user' ? 'USER' : msg.role === 'support' ? 'SUPPORT' : 'ASSISTANT'
    
    if (msg.metadata?.isToolCall && msg.metadata?.toolCall) {
      const tool = msg.metadata.toolCall
      prompt += `[TOOL CALL: ${tool.name}]\n`
      prompt += `Arguments: ${JSON.stringify(tool.arguments)}\n`
      prompt += `Success: ${tool.success}\n`
      if (tool.response) {
        prompt += `Response: ${JSON.stringify(tool.response).substring(0, 500)}\n`
      }
      prompt += '\n'
    } else {
      prompt += `${role}: ${msg.content}\n\n`
    }
  }
  
  prompt += '\n## Your Evaluation (JSON format):\n'
  
  return prompt
}

/**
 * Parse the LLM's response into a structured evaluation
 */
export function parseJudgeResponse(response: string): JudgeEvaluation {
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  
  if (!jsonMatch) {
    const isGood = response.toLowerCase().includes('good') && 
                   !response.toLowerCase().includes('bad')
    
    return {
      rating: isGood ? 'good' : 'bad',
      reasoning: 'Unable to parse structured response',
      confidence: 0.5,
      categories: [],
    }
  }
  
  try {
    const parsed = JSON.parse(jsonMatch[0])
    
    return {
      rating: parsed.rating === 'good' ? 'good' : 'bad',
      reasoning: parsed.reasoning || 'No reasoning provided',
      confidence: typeof parsed.confidence === 'number' 
        ? Math.max(0, Math.min(1, parsed.confidence)) 
        : 0.7,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : undefined,
    }
  } catch (e) {
    return {
      rating: 'bad',
      reasoning: 'Failed to parse evaluation response',
      confidence: 0.3,
      categories: ['Evaluation error'],
    }
  }
}

/**
 * Evaluate a conversation using Claude or OpenAI
 */
export async function evaluateConversation(
  messages: ChatMessageForJudge[],
  context: JudgeContext,
  config: JudgeConfig = DEFAULT_JUDGE_CONFIG
): Promise<JudgeEvaluation> {
  const prompt = buildJudgePrompt(messages, context)
  
  if (config.provider === 'anthropic') {
    return evaluateWithClaude(prompt, config)
  } else {
    return evaluateWithOpenAI(prompt, config)
  }
}

/**
 * Evaluate using Claude (Anthropic)
 */
async function evaluateWithClaude(
  prompt: string,
  config: JudgeConfig
): Promise<JudgeEvaluation> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not configured')
  }
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        system: 'You are an expert conversation quality evaluator. Always respond with valid JSON only, no additional text.',
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.3,
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }
    
    const data = await response.json()
    const content = data.content?.[0]?.text || ''
    
    return parseJudgeResponse(content)
  } catch (error) {
    console.error('Claude evaluation error:', error)
    throw error
  }
}

/**
 * Evaluate using OpenAI
 */
async function evaluateWithOpenAI(
  prompt: string,
  config: JudgeConfig
): Promise<JudgeEvaluation> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not configured')
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert conversation quality evaluator. Always respond with valid JSON only, no additional text.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: config.temperature ?? 0.3,
        max_tokens: 1024,
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    return parseJudgeResponse(content)
  } catch (error) {
    console.error('OpenAI evaluation error:', error)
    throw error
  }
}

/**
 * Batch evaluate multiple conversations
 */
export async function batchEvaluateConversations(
  conversations: Array<{
    sessionId: string
    messages: ChatMessageForJudge[]
    context: JudgeContext
  }>,
  config: JudgeConfig = DEFAULT_JUDGE_CONFIG
): Promise<Array<{
  sessionId: string
  evaluation: JudgeEvaluation
  error?: string
}>> {
  const results = await Promise.all(
    conversations.map(async (conv) => {
      try {
        const evaluation = await evaluateConversation(conv.messages, conv.context, config)
        return { sessionId: conv.sessionId, evaluation }
      } catch (error) {
        return {
          sessionId: conv.sessionId,
          evaluation: {
            rating: 'bad' as const,
            reasoning: 'Evaluation failed',
            confidence: 0,
            categories: [],
          },
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })
  )
  
  return results
}

/**
 * Calculate alignment between human and LLM evaluations
 */
export function calculateAlignment(
  evaluations: Array<{
    humanRating: 'good' | 'bad'
    llmRating: 'good' | 'bad'
  }>
): {
  totalCompared: number
  alignedCount: number
  alignmentRate: number
  breakdown: {
    humanGoodLlmGood: number
    humanGoodLlmBad: number
    humanBadLlmGood: number
    humanBadLlmBad: number
  }
} {
  const breakdown = {
    humanGoodLlmGood: 0,
    humanGoodLlmBad: 0,
    humanBadLlmGood: 0,
    humanBadLlmBad: 0,
  }
  
  for (const eval_ of evaluations) {
    if (eval_.humanRating === 'good' && eval_.llmRating === 'good') {
      breakdown.humanGoodLlmGood++
    } else if (eval_.humanRating === 'good' && eval_.llmRating === 'bad') {
      breakdown.humanGoodLlmBad++
    } else if (eval_.humanRating === 'bad' && eval_.llmRating === 'good') {
      breakdown.humanBadLlmGood++
    } else {
      breakdown.humanBadLlmBad++
    }
  }
  
  const totalCompared = evaluations.length
  const alignedCount = breakdown.humanGoodLlmGood + breakdown.humanBadLlmBad
  const alignmentRate = totalCompared > 0 
    ? Math.round((alignedCount / totalCompared) * 100) 
    : 0
  
  return {
    totalCompared,
    alignedCount,
    alignmentRate,
    breakdown,
  }
}
