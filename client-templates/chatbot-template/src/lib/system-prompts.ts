/**
 * System Prompts Library
 * Fetches prompts from Supabase with fallback to config/prompts.ts defaults.
 */

import { supabaseAdmin } from './supabase'
import { prompts, branding } from './config'

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

function resolvePromptTemplate(template: string): string {
  return template.replace(/\{\{businessName\}\}/g, branding.businessName)
}

const DEFAULT_PROMPTS: Record<string, string> = {
  chatbot: resolvePromptTemplate(prompts.chatbot.prompt),
  voice_agent: resolvePromptTemplate(prompts.voiceAgent.prompt),
}

const DEFAULT_CONFIGS: Record<string, PromptConfig> = {
  chatbot: prompts.chatbot.config,
  voice_agent: prompts.voiceAgent.config,
}

const promptCache = new Map<string, { prompt: SystemPrompt; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function getSystemPrompt(key: string): Promise<SystemPrompt | null> {
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

    promptCache.set(key, { prompt, timestamp: Date.now() })
    return prompt
  } catch (error) {
    console.error(`Error in getSystemPrompt('${key}'):`, error)
    return getDefaultPrompt(key)
  }
}

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

export async function getChatbotPrompt(): Promise<string> {
  const prompt = await getSystemPrompt('chatbot')
  return prompt?.prompt || DEFAULT_PROMPTS.chatbot
}

export async function getVoiceAgentPrompt(): Promise<string> {
  const prompt = await getSystemPrompt('voice_agent')
  return prompt?.prompt || DEFAULT_PROMPTS.voice_agent
}

export function clearPromptCache(key?: string) {
  if (key) {
    promptCache.delete(key)
  } else {
    promptCache.clear()
  }
}

export async function getPromptConfig(key: string): Promise<PromptConfig> {
  const prompt = await getSystemPrompt(key)
  return (prompt?.config || DEFAULT_CONFIGS[key] || {}) as PromptConfig
}

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

  let promptText = basePrompt.prompt

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
      promptText += `\n\n## Current Session Context\n${contextParts.join('\n')}`
    }
  }

  return promptText
}
