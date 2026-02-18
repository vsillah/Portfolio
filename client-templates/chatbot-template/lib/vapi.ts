/**
 * VAPI Voice Agent Client
 * Handles voice chat integration with VAPI
 * 
 * This file is OPTIONAL - delete if voice chat is not needed
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

/**
 * Get VAPI configuration at runtime
 */
export function getVapiConfig() {
  return {
    publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '',
    assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || '',
  }
}

export const VAPI_CONFIG = getVapiConfig()

/**
 * Check if VAPI is configured
 */
export function isVapiConfigured(): boolean {
  const config = getVapiConfig();
  const hasPublicKey = Boolean(config.publicKey && config.publicKey.trim());
  const hasAssistantId = Boolean(config.assistantId && config.assistantId.trim());
  return hasPublicKey && hasAssistantId;
}

// ============================================================================
// Webhook Response Helpers
// ============================================================================

export function createFunctionResponse(result: unknown): { result: unknown } {
  return { result }
}

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
 */
export function extractSessionId(callId: string, metadata?: Record<string, unknown>): string {
  if (metadata?.sessionId && typeof metadata.sessionId === 'string') {
    return metadata.sessionId
  }
  return `voice_${callId}`
}
