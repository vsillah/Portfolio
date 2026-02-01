/**
 * n8n Webhook Client
 * Handles communication with the self-hosted n8n instance for chat and lead qualification
 */

// ============================================================================
// Lead Qualification Types and Functions
// ============================================================================

/**
 * Input fields captured from the contact form
 */
export interface LeadQualificationRequest {
  // Contact Information
  name: string
  email: string
  company?: string
  companyDomain?: string
  linkedinUrl?: string
  message: string
  
  // Lead Qualification Fields (from form)
  annualRevenue?: string
  interestAreas?: string[]
  interestSummary?: string  // Derived from interestAreas for n8n
  isDecisionMaker?: boolean
  
  // Metadata
  submissionId: string
  submittedAt: string
  source: string
  
  // Placeholder fields for n8n to populate (included for schema completeness)
  // These will be filled by the Research Agent and Lead Scoring Agent
  leadScore?: number
  potentialRecommendations?: string[]
}

const N8N_LEAD_WEBHOOK_URL = process.env.N8N_LEAD_WEBHOOK_URL

/**
 * Trigger the n8n lead qualification workflow
 * This fires asynchronously (fire-and-forget) to avoid blocking the user
 */
export async function triggerLeadQualificationWebhook(
  request: LeadQualificationRequest
): Promise<void> {
  if (!N8N_LEAD_WEBHOOK_URL) {
    console.warn('N8N_LEAD_WEBHOOK_URL not configured - skipping lead qualification')
    return
  }

  try {
    const response = await fetch(N8N_LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Lead webhook error:', response.status, errorText)
      throw new Error(`Lead qualification webhook returned ${response.status}: ${errorText}`)
    }
  } catch (error) {
    console.error('Lead webhook failed:', error)
    // Don't throw - this is fire-and-forget, we don't want to fail the main request
  }
}

// ============================================================================
// Chat Types and Functions
// ============================================================================

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
  diagnosticMode?: boolean
  diagnosticAuditId?: string
  diagnosticProgress?: DiagnosticProgress
}

/**
 * Diagnostic category enum
 */
export type DiagnosticCategory = 
  | 'business_challenges'
  | 'tech_stack'
  | 'automation_needs'
  | 'ai_readiness'
  | 'budget_timeline'
  | 'decision_making'

/**
 * Diagnostic progress tracking
 */
export interface DiagnosticProgress {
  currentCategory?: DiagnosticCategory
  completedCategories: DiagnosticCategory[]
  questionsAsked: string[]
  responsesReceived: Record<string, unknown>
}

/**
 * Diagnostic audit request structure for n8n
 */
export interface DiagnosticAuditRequest {
  sessionId: string
  diagnosticAuditId?: string
  message: string
  currentCategory?: DiagnosticCategory
  progress?: DiagnosticProgress
  visitorEmail?: string
  visitorName?: string
}

/**
 * Diagnostic response from n8n
 */
export interface DiagnosticResponse {
  response: string
  diagnosticData?: Partial<DiagnosticAuditData>
  currentCategory?: DiagnosticCategory
  isComplete?: boolean
  nextQuestion?: string
  progress?: DiagnosticProgress
  metadata?: {
    questionsAsked?: string[]
    responsesReceived?: Record<string, unknown>
    [key: string]: unknown
  }
}

/**
 * Complete diagnostic audit data structure
 */
export interface DiagnosticAuditData {
  business_challenges: Record<string, unknown>
  tech_stack: Record<string, unknown>
  automation_needs: Record<string, unknown>
  ai_readiness: Record<string, unknown>
  budget_timeline: Record<string, unknown>
  decision_making: Record<string, unknown>
  diagnostic_summary?: string
  key_insights?: string[]
  recommended_actions?: string[]
  urgency_score?: number
  opportunity_score?: number
  sales_notes?: string
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
 * Send a message to the n8n "When chat message received" trigger
 * Uses the specific payload format required by n8n's chat trigger:
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

    // Add diagnostic mode flags if in diagnostic mode
    if (request.diagnosticMode) {
      payload.diagnosticMode = true
      if (request.diagnosticAuditId) {
        payload.diagnosticAuditId = request.diagnosticAuditId
      }
      if (request.diagnosticProgress) {
        payload.diagnosticProgress = request.diagnosticProgress
      }
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
    const result = Array.isArray(data) ? data[0] : data
    
    // Extract response text - handle cases where response might be a JSON string or object
    let responseText = result.output || result.response || result.text || result.message || ''
    
    // If response is a string that looks like JSON, try to parse it
    if (typeof responseText === 'string' && (responseText.trim().startsWith('{') || responseText.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(responseText)
        if (parsed && typeof parsed === 'object') {
          // If it's a diagnostic response object, extract the response field
          if (parsed.response && typeof parsed.response === 'string') {
            responseText = parsed.response
          } else if (parsed.currentCategory !== undefined) {
            // It's a diagnostic object but response might be nested or missing
            responseText = parsed.response || parsed.text || parsed.message || responseText
          }
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
 * Send diagnostic-specific request to n8n diagnostic workflow
 * Can use separate webhook URL or same webhook with routing
 */
export async function sendDiagnosticToN8n(request: DiagnosticAuditRequest): Promise<DiagnosticResponse> {
  const diagnosticWebhookUrl = process.env.N8N_DIAGNOSTIC_WEBHOOK_URL || N8N_WEBHOOK_URL
  
  if (!diagnosticWebhookUrl) {
    throw new Error('N8N_DIAGNOSTIC_WEBHOOK_URL or N8N_WEBHOOK_URL environment variable is not configured')
  }

  try {
    const payload = {
      action: 'sendMessage',
      sessionId: request.sessionId,
      chatInput: request.message,
      diagnosticMode: true,
      diagnosticAuditId: request.diagnosticAuditId,
      currentCategory: request.currentCategory,
      progress: request.progress,
      visitorEmail: request.visitorEmail,
      visitorName: request.visitorName,
    }

    const response = await fetch(diagnosticWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('n8n diagnostic webhook error:', response.status, errorText)
      
      if (response.status === 404) {
        throw new Error(`n8n diagnostic workflow not found (404). Please ensure: 1) The workflow is ACTIVE in n8n, 2) The webhook URL is correct`)
      }
      
      if (response.status === 500) {
        throw new Error(`n8n diagnostic workflow error (500): ${errorText}. The workflow may not have a diagnostic branch configured. Please check: 1) Add an IF node after webhook to detect diagnosticMode: true, 2) Create diagnostic workflow branch, 3) Ensure workflow is ACTIVE. See N8N_DIAGNOSTIC_SETUP.md for details.`)
      }
      
      throw new Error(`n8n diagnostic webhook returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const result = Array.isArray(data) ? data[0] : data

    // Extract response text - handle multiple response formats from n8n
    let responseText = ''
    
    // Case 1: Result itself is the diagnostic object (response, currentCategory, etc. at top level)
    if (result.response && typeof result.response === 'string' && (result.currentCategory || result.diagnosticData !== undefined)) {
      // This is the expected format - response is a string, other fields are separate
      responseText = result.response
    }
    // Case 2: Response field is a JSON string containing the full object
    else if (typeof result.response === 'string') {
      try {
        const parsed = JSON.parse(result.response)
        if (parsed && typeof parsed === 'object' && parsed.response) {
          // It's a JSON string with nested response field
          responseText = parsed.response
        } else {
          // It's a JSON string but not the expected format, use as-is
          responseText = result.response
        }
      } catch {
        // Not JSON, use as-is
        responseText = result.response
      }
    }
    // Case 3: Response field is an object
    else if (result.response && typeof result.response === 'object') {
      responseText = result.response.response || result.response.text || result.response.message || ''
    }
    // Case 4: Result itself might be the response object (no nested response field)
    else if (result.response === undefined && result.currentCategory !== undefined) {
      // This shouldn't happen, but handle it
      responseText = result.text || result.message || result.output || ''
    }
    // Case 5: Fallback to other fields
    else {
      responseText = result.response || result.output || result.text || result.message || ''
    }

    return {
      response: responseText,
      diagnosticData: result.diagnosticData || (typeof result.response === 'object' ? result.response.diagnosticData : undefined),
      currentCategory: result.currentCategory || (typeof result.response === 'object' ? result.response.currentCategory : undefined),
      isComplete: result.isComplete || (typeof result.response === 'object' ? result.response.isComplete : false) || false,
      nextQuestion: result.nextQuestion,
      progress: result.progress,
      metadata: result.metadata || {},
    }
  } catch (error) {
    console.error('Error communicating with n8n diagnostic workflow:', error)
    throw error
  }
}

/**
 * Trigger diagnostic completion webhook for sales enablement
 * This is called when a diagnostic audit is completed
 */
export async function triggerDiagnosticCompletionWebhook(
  diagnosticAuditId: string,
  diagnosticData: DiagnosticAuditData,
  contactInfo?: { email?: string; name?: string; company?: string }
): Promise<void> {
  const completionWebhookUrl = process.env.N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL || N8N_LEAD_WEBHOOK_URL
  
  if (!completionWebhookUrl) {
    console.warn('Diagnostic completion webhook URL not configured - skipping sales notification')
    return
  }

  try {
    const payload = {
      diagnosticAuditId,
      diagnosticData,
      contactInfo,
      completedAt: new Date().toISOString(),
      source: 'chat_diagnostic',
    }

    const response = await fetch(completionWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Diagnostic completion webhook error:', response.status, errorText)
      // Don't throw - this is fire-and-forget
    }
  } catch (error) {
    console.error('Diagnostic completion webhook failed:', error)
    // Don't throw - this is fire-and-forget
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
    // Send a health check message using n8n chat trigger format
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
