/**
 * System Prompts Library
 * Utilities for fetching and managing system prompts
 */

import { supabaseAdmin } from './supabase'

export interface SystemPrompt {
  id: string
  key: string
  name: string
  prompt: string
  config: Record<string, unknown>
  version: number
  is_active?: boolean
  description?: string
  created_at?: string
  updated_at?: string
}

export interface PromptConfig {
  temperature?: number
  maxTokens?: number
  model?: string
  [key: string]: unknown
}

// Default prompts as fallbacks if database is unavailable
const DEFAULT_PROMPTS: Record<string, string> = {
  chatbot: `You are an AI assistant for Vambah's professional portfolio website. Your role is to help visitors learn about Vambah's work, projects, and services.

## Core Responsibilities
1. Answer questions about Vambah's experience, projects, and services
2. Guide visitors to relevant sections of the portfolio
3. Help visitors understand how Vambah can help with their needs
4. Collect contact information when appropriate
5. Escalate complex inquiries to human support
6. When a visitor shows interest in services or has completed a diagnostic, suggest booking a discovery call
7. Mention active promotional campaigns when relevant (e.g. "win your money back" offers) and guide visitors to the campaigns page or pricing page

## Scheduling a Discovery Call
When a visitor expresses interest in working with Vambah, has completed a diagnostic assessment, or asks about next steps, suggest they book a free discovery call:
- Discovery Call Link: https://calendly.com/amadutown/atas-discovery-call
- Frame it as: "Would you like to schedule a free discovery call to discuss how we can help? You can book a time here: https://calendly.com/amadutown/atas-discovery-call"
- The discovery call is a 30-minute introductory conversation to understand their needs and explore fit

## Tone and Style
- Professional yet approachable
- Clear and concise responses
- Helpful and proactive
- Avoid excessive jargon unless technical context is clear

## Boundaries
- Do not make up information about projects or capabilities
- Do not share private/confidential information
- If unsure, offer to connect the visitor with Vambah directly
- Keep responses focused and relevant to the portfolio context`,

  voice_agent: `You are a voice assistant for Vambah's portfolio. You help callers learn about services and schedule consultations.

## Voice-Specific Guidelines
- Keep responses brief and conversational
- Use natural speech patterns
- Avoid long lists or complex formatting
- Confirm understanding before proceeding
- Offer to repeat or clarify as needed

## Scheduling
When callers express interest in services or want to learn more, suggest booking a discovery call:
- Say something like: "I'd love to set you up with a discovery call so we can dive deeper into your needs. I can send you a booking link - would you like that?"
- The discovery call booking link is: https://calendly.com/amadutown/atas-discovery-call
- It's a free 30-minute introductory call`,

  llm_judge: `You are an expert conversation quality evaluator. Analyze chat conversations between users and AI assistants.

## Evaluation Criteria
1. Response Accuracy: Did the assistant provide correct information?
2. Helpfulness: Did the assistant address user needs?
3. Tone & Professionalism: Was communication appropriate?
4. Tool Usage: Were tools used correctly?
5. Handling of Edge Cases: Were unusual requests handled gracefully?
6. Escalation Appropriateness: Was escalation warranted?

IMPORTANT: Be strict but fair. A "good" rating means the conversation met user needs without significant issues.`,

  diagnostic: `You are conducting a business diagnostic assessment. Understand the visitor's business challenges and needs through a structured conversation.

## Diagnostic Categories
1. Business Challenges
2. Tech Stack
3. Automation Needs
4. AI Readiness
5. Budget & Timeline
6. Decision Making

Ask one question at a time, listen actively, and be consultative.`,

  client_email_reply: `You are helping draft a reply to an email from a client. You have been given:
- The client's email (subject and body)
- Project context: project name, status, milestones progress, last meeting summary, and recent action items

Write a short, professional draft reply that:
1. Acknowledges their message
2. Addresses any questions or concerns using the project context where relevant
3. Is concise and warm
4. Uses an appropriate sign-off (e.g. Best, [Your name])

Do not make up information. If the project context does not contain enough to answer something, suggest a call or follow-up. Keep the tone consistent with client communications.`,
}

const DEFAULT_CONFIGS: Record<string, PromptConfig> = {
  chatbot: { temperature: 0.7, maxTokens: 1024 },
  voice_agent: { temperature: 0.8, maxTokens: 512 },
  llm_judge: { temperature: 0.3, model: 'claude-sonnet-4-20250514' },
  diagnostic: { temperature: 0.7, maxTokens: 1024 },
  client_email_reply: { temperature: 0.6, maxTokens: 1024 },
}

// Cache for prompts (5 minute TTL)
const promptCache = new Map<string, { prompt: SystemPrompt; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get a system prompt by key
 * Uses caching to reduce database calls
 */
export async function getSystemPrompt(key: string): Promise<SystemPrompt | null> {
  // Check cache first
  const cached = promptCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.prompt
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('system_prompts')
      .select('id, key, name, prompt, config, version, is_active')
      .eq('key', key)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error(`Error fetching system prompt '${key}':`, error)
      // Return default if available
      return getDefaultPrompt(key)
    }

    const prompt: SystemPrompt = {
      id: data.id,
      key: data.key,
      name: data.name,
      prompt: data.prompt,
      config: data.config || {},
      version: data.version,
      is_active: data.is_active,
    }

    // Update cache
    promptCache.set(key, { prompt, timestamp: Date.now() })

    return prompt
  } catch (error) {
    console.error(`Error in getSystemPrompt('${key}'):`, error)
    return getDefaultPrompt(key)
  }
}

/**
 * Get default prompt as fallback
 */
function getDefaultPrompt(key: string): SystemPrompt | null {
  if (!DEFAULT_PROMPTS[key]) {
    return null
  }

  return {
    id: `default-${key}`,
    key,
    name: `Default ${key}`,
    prompt: DEFAULT_PROMPTS[key],
    config: DEFAULT_CONFIGS[key] || {},
    version: 0,
    is_active: true,
  }
}

/**
 * Get the chatbot system prompt
 */
export async function getChatbotPrompt(): Promise<string> {
  const prompt = await getSystemPrompt('chatbot')
  return prompt?.prompt || DEFAULT_PROMPTS.chatbot
}

/**
 * Get the voice agent system prompt
 */
export async function getVoiceAgentPrompt(): Promise<string> {
  const prompt = await getSystemPrompt('voice_agent')
  return prompt?.prompt || DEFAULT_PROMPTS.voice_agent
}

/**
 * Get the LLM judge evaluation criteria
 */
export async function getLlmJudgePrompt(): Promise<string> {
  const prompt = await getSystemPrompt('llm_judge')
  return prompt?.prompt || DEFAULT_PROMPTS.llm_judge
}

/**
 * Get the diagnostic agent prompt
 */
export async function getDiagnosticPrompt(): Promise<string> {
  const prompt = await getSystemPrompt('diagnostic')
  return prompt?.prompt || DEFAULT_PROMPTS.diagnostic
}

/**
 * Get the client email draft reply prompt (communications)
 * Used when generating draft replies to inbound client emails.
 */
export async function getClientEmailReplyPrompt(): Promise<string> {
  const prompt = await getSystemPrompt('client_email_reply')
  return prompt?.prompt || DEFAULT_PROMPTS.client_email_reply
}

/**
 * Get all prompts (for admin display)
 */
export async function getAllPrompts(): Promise<SystemPrompt[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_prompts')
      .select('*')
      .order('key')

    if (error) {
      console.error('Error fetching all prompts:', error)
      return []
    }

    return data as SystemPrompt[]
  } catch (error) {
    console.error('Error in getAllPrompts:', error)
    return []
  }
}

/**
 * Clear the prompt cache (call after updates)
 */
export function clearPromptCache(key?: string) {
  if (key) {
    promptCache.delete(key)
  } else {
    promptCache.clear()
  }
}

/**
 * Get prompt config
 */
export async function getPromptConfig(key: string): Promise<PromptConfig> {
  const prompt = await getSystemPrompt(key)
  return (prompt?.config || DEFAULT_CONFIGS[key] || {}) as PromptConfig
}

/**
 * Build a complete system prompt with context
 * Useful for chat requests that need additional context injected
 */
export async function buildSystemPromptWithContext(
  key: string,
  context?: {
    visitorName?: string
    visitorEmail?: string
    sessionInfo?: string
    additionalContext?: string
  }
): Promise<string> {
  const basePrompt = await getSystemPrompt(key)
  if (!basePrompt) {
    return DEFAULT_PROMPTS[key] || ''
  }

  let prompt = basePrompt.prompt

  // Add visitor context if available
  if (context) {
    const contextParts: string[] = []

    if (context.visitorName) {
      contextParts.push(`Visitor Name: ${context.visitorName}`)
    }
    if (context.visitorEmail) {
      contextParts.push(`Visitor Email: ${context.visitorEmail}`)
    }
    if (context.sessionInfo) {
      contextParts.push(`Session Info: ${context.sessionInfo}`)
    }
    if (context.additionalContext) {
      contextParts.push(context.additionalContext)
    }

    if (contextParts.length > 0) {
      prompt += `\n\n## Current Session Context\n${contextParts.join('\n')}`
    }
  }

  return prompt
}
