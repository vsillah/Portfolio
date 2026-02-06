/**
 * n8n Webhook Client
 * Handles communication with the self-hosted n8n instance for chat and lead qualification
 */

// ============================================================================
// Mock Mode Configuration
// ============================================================================

/**
 * Check if mock mode is enabled
 * Set MOCK_N8N=true to bypass n8n calls and return mock responses for testing
 */
const MOCK_N8N = process.env.MOCK_N8N === 'true'

/**
 * Generate mock chat response for testing
 */
function generateMockChatResponse(message: string, diagnosticMode?: boolean): {
  response: string
  escalated: boolean
  metadata: Record<string, unknown>
} {
  const lowerMessage = message.toLowerCase()
  
  // Simulate escalation for certain keywords
  if (lowerMessage.includes('urgent') || lowerMessage.includes('speak to someone')) {
    return {
      response: "I understand this is urgent. Let me connect you with our team right away. Someone will reach out within the hour.",
      escalated: true,
      metadata: { mock: true, escalationReason: 'urgent_request' }
    }
  }
  
  // Simulate diagnostic trigger
  if (lowerMessage.includes('audit') || lowerMessage.includes('diagnostic') || lowerMessage.includes('assessment')) {
    return {
      response: "I'd be happy to help you with a business diagnostic assessment. This will help us understand your current challenges and identify opportunities for improvement. Let's start with your business challenges - what are the main pain points you're facing right now?",
      escalated: false,
      metadata: { mock: true, diagnosticTriggered: true }
    }
  }
  
  // Default responses based on intent
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return {
      response: "Hello! Welcome to our consulting services. I'm here to help you explore how we can support your business goals. What brings you here today?",
      escalated: false,
      metadata: { mock: true, intent: 'greeting' }
    }
  }
  
  if (lowerMessage.includes('services') || lowerMessage.includes('help')) {
    return {
      response: "We offer a range of consulting services including AI strategy, automation implementation, and business process optimization. Would you like to learn more about any specific service, or would you prefer to do a quick diagnostic to identify your biggest opportunities?",
      escalated: false,
      metadata: { mock: true, intent: 'inquiry' }
    }
  }
  
  // Generic response
  return {
    response: "Thank you for your message. Based on what you've shared, I can help guide you to the right solution. Would you like to tell me more about your specific needs or challenges?",
    escalated: false,
    metadata: { mock: true, intent: 'general' }
  }
}

/**
 * Generate mock diagnostic response for testing
 * Simulates a complete diagnostic flow with realistic data
 */
function generateMockDiagnosticResponse(
  message: string,
  currentCategory?: string,
  progress?: DiagnosticProgress
): DiagnosticResponse {
  const categories: DiagnosticCategory[] = [
    'business_challenges',
    'tech_stack', 
    'automation_needs',
    'ai_readiness',
    'budget_timeline',
    'decision_making'
  ]
  
  const completedCategories = progress?.completedCategories || []
  const nextCategoryIndex = completedCategories.length
  
  // Check if all categories are complete
  if (nextCategoryIndex >= categories.length) {
    return {
      response: "Thank you for completing the diagnostic assessment! Based on your responses, I've identified several key opportunities for improvement. Your overall readiness score is strong, and I recommend focusing on automation and AI integration as your next steps. I'll send you a detailed report with specific recommendations.",
      diagnosticData: {
        diagnostic_summary: 'Business shows strong potential for AI/automation adoption',
        urgency_score: 7,
        opportunity_score: 8,
        recommended_actions: ['ai_strategy', 'automation_audit', 'process_optimization'],
        key_insights: [
          'Multiple manual processes identified for automation',
          'Strong leadership buy-in for digital transformation',
          'Clear budget allocation for technology investments'
        ],
        business_challenges: { primary: ['manual_processes', 'scaling_issues'], impact: 'high' },
        tech_stack: { current: ['spreadsheets', 'basic_crm'], readiness: 'medium' },
        automation_needs: { priority_areas: ['data_entry', 'reporting'], potential_savings: 'significant' },
        ai_readiness: { data_quality: 'good', team_readiness: 'moderate' },
        budget_timeline: { budget_range: '$10k-50k', timeline: 'Q2 2026' },
        decision_making: { decision_maker: true, stakeholders: ['CEO', 'CTO'] }
      },
      currentCategory: undefined,
      isComplete: true,
      nextQuestion: undefined,
      progress: {
        completedCategories: categories,
        currentCategory: undefined,
        questionsAsked: [],
        responsesReceived: {}
      },
      metadata: { mock: true, diagnosticComplete: true }
    }
  }
  
  const nextCategory = categories[nextCategoryIndex]
  const questionMap: Record<DiagnosticCategory, string> = {
    business_challenges: "Let's start by understanding your business challenges. What are the main pain points or inefficiencies you're currently facing?",
    tech_stack: "What tools and systems are you currently using? This includes CRM, project management, communication tools, etc.",
    automation_needs: "Which processes or tasks take up the most time that you'd like to automate?",
    ai_readiness: "How would you describe your organization's readiness for AI adoption? Do you have clean data and processes documented?",
    budget_timeline: "What budget range are you considering for improvements, and what's your ideal timeline?",
    decision_making: "Are you the decision maker for technology investments, or who else would be involved?"
  }
  
  return {
    response: questionMap[nextCategory],
    diagnosticData: undefined,
    currentCategory: nextCategory,
    isComplete: false,
    nextQuestion: questionMap[nextCategory],
    progress: {
      completedCategories: [...completedCategories, currentCategory].filter(Boolean) as DiagnosticCategory[],
      currentCategory: nextCategory,
      questionsAsked: [],
      responsesReceived: {}
    },
    metadata: { mock: true, categoryIndex: nextCategoryIndex }
  }
}

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
  source?: 'text' | 'voice'
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
  /** Source channel: 'text' for chat, 'voice' for VAPI */
  source?: 'text' | 'voice'
  /** Summary of earlier conversation for long sessions */
  conversationSummary?: string
  /** Whether this session has cross-channel history */
  hasCrossChannelHistory?: boolean
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
  // Mock mode for testing - bypass n8n and return mock responses
  if (MOCK_N8N) {
    console.log('[MOCK_N8N] Returning mock response for chat')
    return generateMockChatResponse(request.message, request.diagnosticMode)
  }

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

    // Read body text to check for empty response
    const bodyText = await response.text()

    // Handle empty response body gracefully
    if (bodyText.length === 0) {
      console.warn('n8n webhook returned empty response - check workflow configuration')
      return {
        response: "I apologize, but I'm having trouble processing your request right now. Please try again or use the contact form for assistance.",
        escalated: false,
        metadata: { emptyResponse: true, fallback: true }
      }
    }

    let data: unknown
    try {
      data = JSON.parse(bodyText)
    } catch (parseError) {
      console.error('Failed to parse n8n response:', bodyText.substring(0, 200))
      return {
        response: "I apologize, but I received an unexpected response. Please try again.",
        escalated: false,
        metadata: { parseError: true, fallback: true }
      }
    }

    // Handle different response formats from n8n
    let result = Array.isArray(data) ? data[0] : data
    
    // Handle n8n's { results: [{ result: "..." }] } format
    if (result?.results && Array.isArray(result.results) && result.results.length > 0) {
      result = result.results[0]
    }

    // Extract response text - handle cases where response might be a JSON string or object
    // Also check for 'result' field which is used by n8n's AI Agent node
    let responseText = result.output || result.response || result.text || result.message || result.result || ''
    
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
  // Mock mode for testing - bypass n8n and return mock diagnostic responses
  if (MOCK_N8N) {
    console.log('[MOCK_N8N] Returning mock response for diagnostic')
    return generateMockDiagnosticResponse(
      request.message,
      request.currentCategory,
      request.progress
    )
  }

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

    // Read body text first to check for empty response
    const bodyText = await response.text()
    
    // Handle empty response body gracefully
    if (bodyText.length === 0) {
      console.warn('n8n diagnostic webhook returned empty response - check workflow configuration')
      return {
        response: "I apologize, but I'm having trouble processing your diagnostic request right now. Please try again.",
        diagnosticData: undefined,
        currentCategory: undefined,
        isComplete: false,
        nextQuestion: undefined,
        progress: undefined,
        metadata: { emptyResponse: true, fallback: true }
      }
    }

    let data: unknown
    try {
      data = JSON.parse(bodyText)
    } catch (parseError) {
      console.error('Failed to parse n8n diagnostic response:', bodyText.substring(0, 200))
      return {
        response: "I apologize, but I received an unexpected response. Please try again.",
        diagnosticData: undefined,
        currentCategory: undefined,
        isComplete: false,
        nextQuestion: undefined,
        progress: undefined,
        metadata: { parseError: true, fallback: true }
      }
    }

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
