/**
 * n8n Webhook Client
 * Handles communication with the self-hosted n8n instance for chat functionality
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'support'
  content: string
  timestamp?: string
}

export interface N8nChatRequest {
  message: string
  sessionId: string
  history?: ChatMessage[]
  visitorEmail?: string
  visitorName?: string
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

export interface N8nError {
  error: string
  code?: string
}

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL

/**
 * Send a message to the n8n webhook and get a response
 */
export async function sendToN8n(request: N8nChatRequest): Promise<N8nChatResponse> {
  if (!N8N_WEBHOOK_URL) {
    throw new Error('N8N_WEBHOOK_URL environment variable is not configured')
  }

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: request.message,
        sessionId: request.sessionId,
        history: request.history || [],
        visitorEmail: request.visitorEmail,
        visitorName: request.visitorName,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('n8n webhook error:', response.status, errorText)
      throw new Error(`n8n webhook returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    // Handle different response formats from n8n
    // n8n might return the response directly or wrapped in an array
    const result = Array.isArray(data) ? data[0] : data

    return {
      response: result.response || result.output || result.text || result.message || 'I apologize, but I could not process your request. Please try again.',
      escalated: result.escalated || result.escalate || false,
      metadata: result.metadata || {},
    }
  } catch (error) {
    console.error('Error communicating with n8n:', error)
    throw error
  }
}

/**
 * Check if the n8n webhook is reachable
 */
export async function checkN8nHealth(): Promise<boolean> {
  if (!N8N_WEBHOOK_URL) {
    return false
  }

  try {
    // Send a health check message
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '__health_check__',
        sessionId: 'health-check',
        isHealthCheck: true,
      }),
    })

    return response.ok
  } catch {
    return false
  }
}

/**
 * Generate a unique session ID for chat sessions
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `chat_${timestamp}_${randomPart}`
}

/**
 * Format chat history for n8n context
 */
export function formatHistoryForN8n(messages: ChatMessage[]): ChatMessage[] {
  // Limit history to last 10 messages to avoid token limits
  const recentMessages = messages.slice(-10)
  
  return recentMessages.map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
  }))
}
