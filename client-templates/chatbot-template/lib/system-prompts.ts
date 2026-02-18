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
// CUSTOMIZE: Update these for your client's use case
const DEFAULT_PROMPTS: Record<string, string> = {
  chatbot: `You are a helpful AI assistant. Your role is to help visitors with their questions and guide them to the right resources.

## Core Responsibilities
1. Answer questions clearly and accurately
2. Guide visitors to relevant information
3. Collect contact information when appropriate
4. Escalate complex inquiries to human support

## Tone and Style
- Professional yet approachable
- Clear and concise responses
- Helpful and proactive
- Avoid excessive jargon

## Boundaries
- Do not make up information
- Do not share private/confidential information
- If unsure, offer to connect the visitor with support
- Keep responses focused and relevant`,

  voice_agent: `You are a voice assistant. You help callers with their questions and can schedule consultations.

## Voice-Specific Guidelines
- Keep responses brief and conversational
- Use natural speech patterns
- Avoid long lists or complex formatting
- Confirm understanding before proceeding
- Offer to repeat or clarify as needed`,
}

const DEFAULT_CONFIGS: Record<string, PromptConfig> = {
  chatbot: { temperature: 0.7, maxTokens: 1024 },
  voice_agent: { temperature: 0.8, maxTokens: 512 },
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
