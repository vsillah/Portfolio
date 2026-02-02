/**
 * VAPI Voice Agent Client
 * Handles voice chat integration with VAPI and communication with N8N workflows
 */

// ============================================================================
// VAPI Types
// ============================================================================

export interface VapiMessage {
  type: 'transcript' | 'function-call' | 'hang' | 'speech-update' | 'metadata' | 'conversation-update'
  role?: 'user' | 'assistant' | 'system'
  transcript?: string
  transcriptType?: 'partial' | 'final'
  functionCall?: {
    name: string
    parameters: Record<string, unknown>
  }
  [key: string]: unknown
}

export interface VapiCallStatus {
  status: 'ringing' | 'in-progress' | 'forwarding' | 'ended'
  endedReason?: string
}

export interface VapiWebhookPayload {
  message: {
    type: string
    call?: {
      id: string
      status: string
      customer?: {
        number?: string
        name?: string
      }
      metadata?: Record<string, unknown>
    }
    role?: string
    transcript?: string
    transcriptType?: string
    functionCall?: {
      name: string
      parameters: Record<string, unknown>
    }
    [key: string]: unknown
  }
}

export interface VapiAssistantOverrides {
  firstMessage?: string
  model?: {
    provider?: string
    model?: string
    messages?: Array<{
      role: string
      content: string
    }>
  }
  variableValues?: Record<string, string>
  metadata?: Record<string, unknown>
}

// ============================================================================
// VAPI Event Types for Web SDK
// ============================================================================

export type VapiEventType = 
  | 'call-start'
  | 'call-end'
  | 'speech-start'
  | 'speech-end'
  | 'volume-level'
  | 'message'
  | 'error'

export interface VapiEventHandlers {
  onCallStart?: () => void
  onCallEnd?: () => void
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onVolumeLevel?: (volume: number) => void
  onMessage?: (message: VapiMessage) => void
  onError?: (error: Error) => void
}

// ============================================================================
// Chat Session Types for Voice Integration
// ============================================================================

export interface VoiceChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isVoice: boolean
  transcriptType?: 'partial' | 'final'
}

export interface VoiceSessionState {
  isConnected: boolean
  isListening: boolean
  isSpeaking: boolean
  volumeLevel: number
  error: string | null
}

// ============================================================================
// VAPI Configuration
// ============================================================================

export const VAPI_CONFIG = {
  publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '',
  assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || '',
}

/**
 * Check if VAPI is configured
 */
export function isVapiConfigured(): boolean {
  return Boolean(VAPI_CONFIG.publicKey && VAPI_CONFIG.assistantId)
}

// ============================================================================
// Webhook Response Helpers
// ============================================================================

/**
 * Create a function call response for VAPI webhook
 */
export function createFunctionResponse(result: unknown): { result: unknown } {
  return { result }
}

/**
 * Create an error response for VAPI webhook
 */
export function createErrorResponse(error: string): { error: string } {
  return { error }
}

// ============================================================================
// N8N Integration Helpers
// ============================================================================

/**
 * Format VAPI transcript for N8N chat workflow
 */
export function formatTranscriptForN8n(
  transcript: string,
  sessionId: string,
  metadata?: Record<string, unknown>
): {
  action: string
  sessionId: string
  chatInput: string
  source: string
  metadata?: Record<string, unknown>
} {
  return {
    action: 'sendMessage',
    sessionId,
    chatInput: transcript,
    source: 'voice',
    metadata,
  }
}

/**
 * Extract session ID from VAPI call metadata
 * Falls back to generating one from call ID if not provided
 */
export function extractSessionId(callId: string, metadata?: Record<string, unknown>): string {
  if (metadata?.sessionId && typeof metadata.sessionId === 'string') {
    return metadata.sessionId
  }
  // Generate a session ID based on the call ID
  return `voice_${callId}`
}
