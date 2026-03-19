/**
 * n8n Webhook Client
 */

import { integrations } from './config'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'support'
  content: string
  timestamp?: string
  source?: 'text' | 'voice'
}

export interface N8nChatRequest {
  message: string
  sessionId: string
  history?: ChatMessage[]
  visitorEmail?: string
  visitorName?: string
  source?: 'text' | 'voice'
  conversationSummary?: string
  hasCrossChannelHistory?: boolean
}

export interface N8nChatResponse {
  response: string
  escalated: boolean
  metadata?: {
    confidence?: number
    suggestedActions?: string[]
    [key: string]: unknown
  }
}

export async function sendToN8n(request: N8nChatRequest): Promise<N8nChatResponse> {
  const webhookUrl = integrations.n8n.webhookUrl
  if (!webhookUrl) {
    throw new Error('N8N_WEBHOOK_URL environment variable is not configured')
  }

  try {
    const payload: Record<string, unknown> = {
      action: 'sendMessage',
      sessionId: request.sessionId,
      chatInput: request.message,
    }

    if (request.source) {
      payload.source = request.source
    }
    if (request.history && request.history.length > 0) {
      payload.history = request.history
    }
    if (request.conversationSummary) {
      payload.conversationSummary = request.conversationSummary
    }
    if (request.hasCrossChannelHistory) {
      payload.hasCrossChannelHistory = true
    }
    if (request.visitorEmail) {
      payload.visitorEmail = request.visitorEmail
    }
    if (request.visitorName) {
      payload.visitorName = request.visitorName
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('n8n webhook error:', response.status, errorText)

      if (response.status === 404) {
        throw new Error('n8n workflow not found (404). Please ensure: 1) The workflow is ACTIVE in n8n, 2) The webhook URL is correct')
      }
      throw new Error(`n8n webhook returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    let result = Array.isArray(data) ? data[0] : data

    if (result?.results && Array.isArray(result.results) && result.results.length > 0) {
      result = result.results[0]
    }

    let responseText = result.output || result.response || result.text || result.message || result.result || ''

    if (typeof responseText === 'string' && (responseText.trim().startsWith('{') || responseText.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(responseText)
        if (parsed && typeof parsed === 'object' && parsed.response) {
          responseText = parsed.response
        }
      } catch {
        // Not valid JSON, use as-is
      }
    } else if (typeof responseText === 'object' && responseText !== null) {
      responseText = responseText.response || responseText.text || responseText.message || ''
    }

    return {
      response: responseText || 'I apologize, but I could not process your request. Please try again.',
      escalated: result.escalated || result.escalate || false,
      metadata: result.metadata || {},
    }
  } catch (error) {
    console.error('Error communicating with n8n:', error)
    throw error
  }
}

export async function checkN8nHealth(): Promise<boolean> {
  const webhookUrl = integrations.n8n.webhookUrl
  if (!webhookUrl) {
    return false
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendMessage',
        sessionId: 'health-check',
        chatInput: '__health_check__',
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

export function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `chat_${timestamp}_${randomPart}`
}

export function formatHistoryForN8n(messages: ChatMessage[]): ChatMessage[] {
  const recentMessages = messages.slice(-10)
  return recentMessages.map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
  }))
}
