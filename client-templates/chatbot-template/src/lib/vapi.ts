/**
 * VAPI Voice Agent Client
 * This file is OPTIONAL — delete if voice chat is not needed.
 */

import { integrations } from './config'

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

export function getVapiConfig() {
  return {
    publicKey: integrations.vapi.publicKey,
    assistantId: integrations.vapi.assistantId,
  }
}

export const VAPI_CONFIG = getVapiConfig()

export function isVapiConfigured(): boolean {
  const config = getVapiConfig()
  return Boolean(config.publicKey?.trim()) && Boolean(config.assistantId?.trim())
}

export function createFunctionResponse(result: unknown): { result: unknown } {
  return { result }
}

export function createErrorResponse(error: string): { error: string } {
  return { error }
}

export function formatTranscriptForN8n(
  transcript: string,
  sessionId: string,
  metadata?: Record<string, unknown>
) {
  return {
    action: 'sendMessage',
    sessionId,
    chatInput: transcript,
    source: 'voice',
    metadata,
  }
}

export function extractSessionId(callId: string, metadata?: Record<string, unknown>): string {
  if (metadata?.sessionId && typeof metadata.sessionId === 'string') {
    return metadata.sessionId
  }
  return `voice_${callId}`
}
