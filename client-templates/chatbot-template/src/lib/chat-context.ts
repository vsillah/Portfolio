/**
 * Chat Context Utilities
 *
 * Fetches and formats conversation history from Supabase
 * for context injection into n8n workflows.
 */

import { supabaseAdmin } from './supabase'
import { prompts } from './config'

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'support'
  content: string
  timestamp: string
  source?: 'text' | 'voice'
}

export interface ConversationContext {
  history: ConversationMessage[]
  summary?: string
  sessionInfo: {
    sessionId: string
    visitorName?: string
    visitorEmail?: string
    isEscalated: boolean
    hasVoiceMessages: boolean
    hasTextMessages: boolean
    messageCount: number
  }
}

export async function fetchConversationContext(
  sessionId: string,
  limit: number = 20
): Promise<ConversationContext | null> {
  try {
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content, metadata, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit * 2)

    if (error) {
      console.error('Error fetching context:', error)
      return null
    }

    const formattedMessages: ConversationMessage[] = (messages || []).map((msg: { role: string; content: string; metadata?: Record<string, unknown>; created_at: string }) => ({
      role: msg.role as 'user' | 'assistant' | 'support',
      content: msg.content,
      timestamp: msg.created_at,
      source: (msg.metadata?.source as 'text' | 'voice') || 'text',
    }))

    const recentMessages = formattedMessages.slice(-limit)
    const hasVoiceMessages = formattedMessages.some(m => m.source === 'voice')
    const hasTextMessages = formattedMessages.some(m => m.source === 'text' || !m.source)

    const context: ConversationContext = {
      history: recentMessages,
      sessionInfo: {
        sessionId,
        visitorName: session?.visitor_name || undefined,
        visitorEmail: session?.visitor_email || undefined,
        isEscalated: session?.is_escalated || false,
        hasVoiceMessages,
        hasTextMessages,
        messageCount: formattedMessages.length,
      },
    }

    if (formattedMessages.length > 20) {
      context.summary = generateConversationSummary(formattedMessages.slice(0, -10))
    }

    return context
  } catch (error) {
    console.error('Error in fetchConversationContext:', error)
    return null
  }
}

function generateConversationSummary(messages: ConversationMessage[]): string {
  if (messages.length === 0) return ''

  const userMessages = messages.filter(m => m.role === 'user')
  const topics: string[] = []

  const topicKeywords = prompts.topicKeywords

  userMessages.forEach(msg => {
    const lowerContent = msg.content.toLowerCase()
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(kw => lowerContent.includes(kw)) && !topics.includes(topic)) {
        topics.push(topic)
      }
    })
  })

  const channelInfo = messages.some(m => m.source === 'voice') && messages.some(m => m.source === 'text')
    ? 'The conversation has occurred across both text and voice channels. '
    : ''

  const topicInfo = topics.length > 0
    ? `Topics discussed include: ${topics.join(', ')}. `
    : ''

  return `${channelInfo}${topicInfo}Total of ${messages.length} earlier messages in this conversation.`
}
