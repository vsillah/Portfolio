/**
 * LLM-as-a-Judge Evaluation Service
 * Uses an LLM to evaluate chat conversations for quality assessment
 * Supports multiple providers (Claude, OpenAI) for A/B testing
 */

import { getLlmJudgePrompt, getChatbotPrompt, getVoiceAgentPrompt, getPromptConfig } from './system-prompts'

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
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Previous generation, reliable' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable OpenAI model' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective' },
  ],
}

// Default configuration - Claude as primary
export const DEFAULT_JUDGE_CONFIG: JudgeConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  promptVersion: 'v1',
  temperature: 0.3,
}

// Fallback evaluation criteria (used if database is unavailable)
const FALLBACK_EVALUATION_CRITERIA = `
You are an expert conversation quality evaluator. Analyze the following chat conversation between a user and an AI assistant.

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
`

// JSON output format instructions (appended to any evaluation criteria)
const JSON_OUTPUT_INSTRUCTIONS = `

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
- "System prompt violation"
`

/**
 * Get the evaluation criteria from database or fallback
 */
async function getEvaluationCriteria(): Promise<string> {
  try {
    const criteria = await getLlmJudgePrompt()
    // Ensure JSON output format is included
    if (!criteria.includes('"rating"')) {
      return criteria + JSON_OUTPUT_INSTRUCTIONS
    }
    return criteria
  } catch (error) {
    console.error('Error fetching evaluation criteria, using fallback:', error)
    return FALLBACK_EVALUATION_CRITERIA
  }
}

/**
 * Get the chatbot's system prompt for context in evaluation
 */
async function getChatbotSystemPromptForContext(channel: 'text' | 'voice'): Promise<string | null> {
  try {
    if (channel === 'voice') {
      return await getVoiceAgentPrompt()
    }
    return await getChatbotPrompt()
  } catch (error) {
    console.error('Error fetching chatbot prompt for context:', error)
    return null
  }
}

/**
 * Get model config from database
 */
async function getJudgeModelConfig(): Promise<JudgeConfig> {
  try {
    const config = await getPromptConfig('llm_judge')
    return {
      provider: 'anthropic',
      model: (config.model as string) || DEFAULT_JUDGE_CONFIG.model,
      promptVersion: 'v1',
      temperature: (config.temperature as number) || DEFAULT_JUDGE_CONFIG.temperature,
    }
  } catch (error) {
    console.error('Error fetching judge config:', error)
    return DEFAULT_JUDGE_CONFIG
  }
}

/**
 * Build the prompt for the LLM judge
 * Now async to fetch criteria from database
 */
export async function buildJudgePrompt(
  messages: ChatMessageForJudge[],
  context: JudgeContext
): Promise<string> {
  // Get evaluation criteria from database
  const evaluationCriteria = await getEvaluationCriteria()
  
  let prompt = evaluationCriteria + '\n\n'
  
  // Add the chatbot's system prompt for context (helps judge alignment)
  const chatbotPrompt = context.systemPrompt || await getChatbotSystemPromptForContext(context.channel)
  if (chatbotPrompt) {
    prompt += '## Chatbot System Prompt (for reference)\n'
    prompt += 'The assistant was configured with the following system prompt. '
    prompt += 'Consider whether responses aligned with these guidelines:\n\n'
    prompt += '```\n' + chatbotPrompt.substring(0, 2000) + '\n```\n\n'
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
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  
  if (!jsonMatch) {
    // If no JSON found, try to infer from text
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
 * Evaluate a conversation using Claude (default) or OpenAI
 * Supports A/B testing between different models and providers
 * Now fetches config from database if not provided
 */
export async function evaluateConversation(
  messages: ChatMessageForJudge[],
  context: JudgeContext,
  config?: JudgeConfig
): Promise<JudgeEvaluation> {
  // Use provided config or fetch from database
  const judgeConfig = config || await getJudgeModelConfig()
  
  // Build prompt (now async to fetch criteria from database)
  const prompt = await buildJudgePrompt(messages, context)
  
  if (judgeConfig.provider === 'anthropic') {
    return evaluateWithClaude(prompt, judgeConfig)
  } else {
    return evaluateWithOpenAI(prompt, judgeConfig)
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
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
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
          {
            role: 'user',
            content: prompt,
          },
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
        return {
          sessionId: conv.sessionId,
          evaluation,
        }
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

// ============================================================================
// Axial Coding Functions
// For qualitative research: generating higher-level categories from open codes
// ============================================================================

export interface OpenCodeWithContext {
  code: string
  sessionId: string
  rating?: 'good' | 'bad'
  notes?: string
}

export interface AxialCodeResult {
  code: string
  description: string
  source_open_codes: string[]
  source_sessions: string[]
}

export interface AxialCodeGenerationResult {
  axial_codes: AxialCodeResult[]
}

const AXIAL_CODING_PROMPT = `You are a qualitative research analyst performing axial coding on chat evaluation data.

Axial coding is a qualitative research technique where you identify relationships between open codes and group them into higher-level conceptual categories (axial codes).

Given the following open codes from chat evaluation sessions, generate axial codes that:
1. Group semantically related open codes together
2. Have clear, concise category names (2-4 words)
3. Include descriptions explaining what issues each category captures
4. Map each input open code to exactly one axial code

Guidelines:
- Create 3-8 axial codes depending on the diversity of input codes
- Each axial code should represent a distinct theme or issue type
- Use professional, clear language for category names
- Ensure all input open codes are mapped to an axial code
- If an open code doesn't fit well with others, it can be its own axial code

Output your response as valid JSON only, no additional text.`

/**
 * Build prompt for axial code generation
 */
function buildAxialCodingPrompt(openCodes: OpenCodeWithContext[]): string {
  let prompt = AXIAL_CODING_PROMPT + '\n\n'
  
  prompt += '## Input Open Codes\n\n'
  
  // Group by unique codes and show their frequency/context
  const codeMap = new Map<string, { count: number; sessions: string[]; notes: string[] }>()
  
  for (const oc of openCodes) {
    if (!codeMap.has(oc.code)) {
      codeMap.set(oc.code, { count: 0, sessions: [], notes: [] })
    }
    const entry = codeMap.get(oc.code)!
    entry.count++
    entry.sessions.push(oc.sessionId)
    if (oc.notes) entry.notes.push(oc.notes)
  }
  
  for (const [code, data] of codeMap) {
    prompt += `- "${code}" (used ${data.count} time${data.count > 1 ? 's' : ''})\n`
    if (data.notes.length > 0) {
      const uniqueNotes = [...new Set(data.notes)].slice(0, 3)
      prompt += `  Context from evaluator notes: ${uniqueNotes.join('; ').substring(0, 200)}\n`
    }
  }
  
  prompt += `\n## Expected Output Format\n
{
  "axial_codes": [
    {
      "code": "Category Name",
      "description": "What this category represents and why these codes are grouped together",
      "source_open_codes": ["code1", "code2", "code3"]
    }
  ]
}

Generate the axial codes now:`
  
  return prompt
}

/**
 * Parse axial code generation response
 */
function parseAxialCodeResponse(response: string, openCodes: OpenCodeWithContext[]): AxialCodeGenerationResult {
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  
  if (!jsonMatch) {
    throw new Error('No valid JSON found in response')
  }
  
  try {
    const parsed = JSON.parse(jsonMatch[0])
    
    if (!Array.isArray(parsed.axial_codes)) {
      throw new Error('Response missing axial_codes array')
    }
    
    // Build a map of open code to sessions for mapping
    const codeToSessions = new Map<string, string[]>()
    for (const oc of openCodes) {
      if (!codeToSessions.has(oc.code)) {
        codeToSessions.set(oc.code, [])
      }
      codeToSessions.get(oc.code)!.push(oc.sessionId)
    }
    
    // Enrich results with session mappings
    const axialCodes: AxialCodeResult[] = parsed.axial_codes.map((ac: any) => {
      const sourceOpenCodes = Array.isArray(ac.source_open_codes) ? ac.source_open_codes : []
      
      // Get all sessions that have any of the source open codes
      const sourceSessions = new Set<string>()
      for (const oc of sourceOpenCodes) {
        const sessions = codeToSessions.get(oc) || []
        sessions.forEach(s => sourceSessions.add(s))
      }
      
      return {
        code: ac.code || 'Unnamed Category',
        description: ac.description || '',
        source_open_codes: sourceOpenCodes,
        source_sessions: [...sourceSessions],
      }
    })
    
    return { axial_codes: axialCodes }
  } catch (e) {
    throw new Error(`Failed to parse axial code response: ${e}`)
  }
}

/**
 * Generate axial codes from open codes using Claude
 */
async function generateAxialCodesWithClaude(
  prompt: string,
  config: JudgeConfig
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not configured')
  }
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: 'You are a qualitative research analyst. Always respond with valid JSON only, no additional text.',
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature ?? 0.3,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${error}`)
  }
  
  const data = await response.json()
  return data.content?.[0]?.text || ''
}

/**
 * Generate axial codes from open codes using OpenAI
 */
async function generateAxialCodesWithOpenAI(
  prompt: string,
  config: JudgeConfig
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not configured')
  }
  
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
          content: 'You are a qualitative research analyst. Always respond with valid JSON only, no additional text.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: config.temperature ?? 0.3,
      max_tokens: 2048,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }
  
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Generate axial codes from a list of open codes
 * Main entry point for axial code generation
 */
export async function generateAxialCodes(
  openCodes: OpenCodeWithContext[],
  config: JudgeConfig = DEFAULT_JUDGE_CONFIG
): Promise<AxialCodeGenerationResult> {
  if (openCodes.length === 0) {
    return { axial_codes: [] }
  }
  
  const prompt = buildAxialCodingPrompt(openCodes)
  
  let responseText: string
  
  if (config.provider === 'anthropic') {
    responseText = await generateAxialCodesWithClaude(prompt, config)
  } else {
    responseText = await generateAxialCodesWithOpenAI(prompt, config)
  }
  
  return parseAxialCodeResponse(responseText, openCodes)
}

// ============================================================================
// End Axial Coding Functions
// ============================================================================

// ============================================================================
// Error Diagnosis Functions
// For AI-powered root cause analysis of admin-confirmed errors
// ============================================================================

export interface SessionData {
  session_id: string
  visitor_name?: string
  visitor_email?: string
  is_escalated?: boolean
  channel: 'text' | 'voice'
  messages: ChatMessageForJudge[]
  metadata?: Record<string, unknown>
}

export interface EvaluationData {
  id: string
  rating: 'bad'
  notes?: string
  tags?: string[]
  category_id?: string
  open_code?: string
  category?: {
    name: string
    description?: string
  }
}

export interface ErrorDiagnosis {
  root_cause: string
  error_type: 'prompt' | 'code' | 'both' | 'unknown'
  confidence: number
  diagnosis_details: {
    prompt_issues?: string[]
    code_issues?: string[]
    context_clues?: string[]
  }
  recommendations: Array<{
    id?: string
    type: 'prompt' | 'code'
    priority: 'high' | 'medium' | 'low'
    description: string
    changes: {
      target: string // prompt key or file path
      old_value?: string
      new_value: string
      can_auto_apply: boolean
    }
    application_instructions?: string
  }>
}

const ERROR_DIAGNOSIS_PROMPT = `You are an expert software engineer and AI systems analyst performing root cause analysis on chat conversation errors.

Your task is to diagnose why an error occurred in a chat session and recommend specific fixes.

## Analysis Framework

1. **Review the Error Context:**
   - Admin's notes about what went wrong
   - Error category/classification
   - Full conversation history
   - Tool calls and their outcomes
   - System prompt used

2. **Identify Root Cause:**
   Determine if the error is:
   - **Prompt-related**: Misunderstanding, tone issues, format problems, missing instructions
   - **Code-related**: Tool failures, API errors, logic bugs, missing error handling
   - **Both**: Prompt leads to code path that fails, or code doesn't handle prompt edge cases
   - **Unknown**: Insufficient information to determine

3. **Generate Recommendations:**
   For each identified issue, provide:
   - Specific fix (prompt change or code change)
   - Priority level (high/medium/low)
   - Whether it can be auto-applied
   - Step-by-step instructions if manual application needed

## Output Format

Provide your analysis as valid JSON only, no additional text.`

/**
 * Build prompt for error diagnosis
 */
function buildErrorDiagnosisPrompt(
  session: SessionData,
  evaluation: EvaluationData,
  systemPrompt?: string
): string {
  let prompt = ERROR_DIAGNOSIS_PROMPT + '\n\n'
  
  prompt += '## Error Information\n\n'
  prompt += `**Admin Rating:** ${evaluation.rating}\n`
  if (evaluation.category) {
    prompt += `**Error Category:** ${evaluation.category.name}\n`
    if (evaluation.category.description) {
      prompt += `**Category Description:** ${evaluation.category.description}\n`
    }
  }
  if (evaluation.open_code) {
    prompt += `**Open Code:** ${evaluation.open_code}\n`
  }
  if (evaluation.notes) {
    prompt += `**Admin Notes:** ${evaluation.notes}\n`
  }
  if (evaluation.tags && evaluation.tags.length > 0) {
    prompt += `**Tags:** ${evaluation.tags.join(', ')}\n`
  }
  prompt += '\n'
  
  // Add system prompt for context
  if (systemPrompt) {
    prompt += '## System Prompt Used\n'
    prompt += 'The assistant was configured with this system prompt:\n\n'
    prompt += '```\n' + systemPrompt.substring(0, 2000) + '\n```\n\n'
  }
  
  // Add conversation context
  prompt += '## Conversation Context\n'
  prompt += `- Channel: ${session.channel}\n`
  prompt += `- Total messages: ${session.messages.length}\n`
  if (session.visitor_name) prompt += `- Visitor: ${session.visitor_name}\n`
  if (session.visitor_email) prompt += `- Email: ${session.visitor_email}\n`
  if (session.is_escalated) prompt += `- Escalated: Yes\n`
  prompt += '\n'
  
  // Add conversation
  prompt += '## Conversation History\n\n'
  for (const msg of session.messages) {
    const role = msg.role === 'user' ? 'USER' : msg.role === 'support' ? 'SUPPORT' : 'ASSISTANT'
    
    if (msg.metadata?.isToolCall && msg.metadata?.toolCall) {
      const tool = msg.metadata.toolCall
      prompt += `[TOOL CALL: ${tool.name}]\n`
      prompt += `Arguments: ${JSON.stringify(tool.arguments)}\n`
      prompt += `Success: ${tool.success ? 'Yes' : 'No'}\n`
      if (!tool.success) {
        prompt += `**ERROR:** Tool call failed\n`
      }
      if (tool.response) {
        prompt += `Response: ${JSON.stringify(tool.response).substring(0, 500)}\n`
      }
      prompt += '\n'
    } else {
      prompt += `${role}: ${msg.content}\n\n`
    }
  }
  
  prompt += `\n## Expected Output Format

{
  "root_cause": "Clear explanation of why the error occurred (2-3 sentences)",
  "error_type": "prompt" | "code" | "both" | "unknown",
  "confidence": 0.0 to 1.0,
  "diagnosis_details": {
    "prompt_issues": ["list of prompt-related issues if applicable"],
    "code_issues": ["list of code-related issues if applicable"],
    "context_clues": ["key observations that led to diagnosis"]
  },
  "recommendations": [
    {
      "type": "prompt" | "code",
      "priority": "high" | "medium" | "low",
      "description": "What needs to be fixed and why",
      "changes": {
        "target": "prompt key (e.g., 'chatbot') or file path (e.g., 'lib/n8n.ts')",
        "old_value": "current value (if applicable)",
        "new_value": "proposed fix",
        "can_auto_apply": true | false
      },
      "application_instructions": "Step-by-step instructions if can_auto_apply is false"
    }
  ]
}

Analyze the error and provide your diagnosis:`
  
  return prompt
}

/**
 * Parse error diagnosis response
 */
function parseErrorDiagnosisResponse(response: string): ErrorDiagnosis {
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  
  if (!jsonMatch) {
    throw new Error('No valid JSON found in diagnosis response')
  }
  
  try {
    const parsed = JSON.parse(jsonMatch[0])
    
    // Validate required fields
    if (!parsed.root_cause || !parsed.error_type || !parsed.recommendations) {
      throw new Error('Missing required fields in diagnosis response')
    }
    
    // Ensure recommendations have IDs
    const recommendations = Array.isArray(parsed.recommendations) 
      ? parsed.recommendations.map((rec: any, index: number) => ({
          ...rec,
          id: rec.id || `rec_${index}`,
        }))
      : []
    
    return {
      root_cause: parsed.root_cause,
      error_type: ['prompt', 'code', 'both', 'unknown'].includes(parsed.error_type)
        ? parsed.error_type
        : 'unknown',
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.7,
      diagnosis_details: {
        prompt_issues: Array.isArray(parsed.diagnosis_details?.prompt_issues)
          ? parsed.diagnosis_details.prompt_issues
          : [],
        code_issues: Array.isArray(parsed.diagnosis_details?.code_issues)
          ? parsed.diagnosis_details.code_issues
          : [],
        context_clues: Array.isArray(parsed.diagnosis_details?.context_clues)
          ? parsed.diagnosis_details.context_clues
          : [],
      },
      recommendations,
    }
  } catch (e) {
    throw new Error(`Failed to parse error diagnosis response: ${e}`)
  }
}

/**
 * Diagnose error using Claude
 */
async function diagnoseErrorWithClaude(
  prompt: string,
  config: JudgeConfig
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not configured')
  }
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: 'You are an expert software engineer and AI systems analyst. Always respond with valid JSON only, no additional text.',
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature ?? 0.3,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${error}`)
  }
  
  const data = await response.json()
  return data.content?.[0]?.text || ''
}

/**
 * Diagnose error using OpenAI
 */
async function diagnoseErrorWithOpenAI(
  prompt: string,
  config: JudgeConfig
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not configured')
  }
  
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
          content: 'You are an expert software engineer and AI systems analyst. Always respond with valid JSON only, no additional text.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: config.temperature ?? 0.3,
      max_tokens: 4096,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }
  
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Diagnose an error in a chat session
 * Main entry point for error diagnosis
 */
export async function diagnoseError(
  session: SessionData,
  evaluation: EvaluationData,
  systemPrompt?: string,
  config: JudgeConfig = DEFAULT_JUDGE_CONFIG
): Promise<ErrorDiagnosis> {
  const prompt = buildErrorDiagnosisPrompt(session, evaluation, systemPrompt)
  
  let responseText: string
  
  if (config.provider === 'anthropic') {
    responseText = await diagnoseErrorWithClaude(prompt, config)
  } else {
    responseText = await diagnoseErrorWithOpenAI(prompt, config)
  }
  
  return parseErrorDiagnosisResponse(responseText)
}

// ============================================================================
// End Error Diagnosis Functions
// ============================================================================

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
