/**
 * n8n Webhook Client
 * Handles communication with n8n for chat processing
 */

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
  /** Source channel: 'text' for chat, 'voice' for VAPI */
  source?: 'text' | 'voice'
  /** Summary of earlier conversation for long sessions */
  conversationSummary?: string
  /** Whether this session has cross-channel history */
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

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL

/**
 * Send a message to the n8n chat workflow
 * Uses the payload format required by n8n's chat trigger:
 * - action: "sendMessage" (required)
 * - sessionId: Used by Simple Memory for conversation tracking
 * - chatInput: The user's message
 */
export async function sendToN8n(request: N8nChatRequest): Promise<N8nChatResponse> {
  if (!N8N_WEBHOOK_URL) {
    throw new Error('N8N_WEBHOOK_URL environment variable is not configured')
  }

  try {
    const payload: Record<string, unknown> = {
      action: 'sendMessage',
      sessionId: request.sessionId,
      chatInput: request.message,
    }

    // Add source channel info
    if (request.source) {
      payload.source = request.source
    }

    // Add conversation history for context
    if (request.history && request.history.length > 0) {
      payload.history = request.history
    }

    // Add conversation summary for long sessions
    if (request.conversationSummary) {
      payload.conversationSummary = request.conversationSummary
    }

    // Add cross-channel flag
    if (request.hasCrossChannelHistory) {
      payload.hasCrossChannelHistory = true
    }

    // Add visitor info if provided
    if (request.visitorEmail) {
      payload.visitorEmail = request.visitorEmail
    }
    if (request.visitorName) {
      payload.visitorName = request.visitorName
    }

    const response = await fetch(N8N_WEBHOOK_URL, {
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
        throw new Error(`n8n workflow not found (404). Please ensure: 1) The workflow is ACTIVE in n8n, 2) The webhook URL is correct`)
      }
      throw new Error(`n8n webhook returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    // Handle different response formats from n8n
    let result = Array.isArray(data) ? data[0] : data
    
    // Handle n8n's { results: [{ result: "..." }] } format
    if (result?.results && Array.isArray(result.results) && result.results.length > 0) {
      result = result.results[0]
    }

    // Extract response text - handle cases where response might be a JSON string or object
    let responseText = result.output || result.response || result.text || result.message || result.result || ''
    
    // If response is a string that looks like JSON, try to parse it
    if (typeof responseText === 'string' && (responseText.trim().startsWith('{') || responseText.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(responseText)
        if (parsed && typeof parsed === 'object' && parsed.response) {
          responseText = parsed.response
        }
      } catch {
        // Not valid JSON, use as-is
      }
    }
    // If response is an object, extract text field
    else if (typeof responseText === 'object' && responseText !== null) {
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

/**
 * Check if the n8n webhook is reachable
 */
export async function checkN8nHealth(): Promise<boolean> {
  if (!N8N_WEBHOOK_URL) {
    return false
  }

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
