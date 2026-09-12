import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createErrorResponse,
  createFunctionResponse,
  extractSessionId,
  formatTranscriptForN8n,
  getVapiConfig,
  isVapiConfigured,
} from './vapi'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

describe('VAPI helpers', () => {
  beforeEach(() => {
    restoreEnv()
    delete process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
    delete process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID
  })

  afterEach(() => {
    restoreEnv()
  })

  it('prefers an explicit sessionId from call metadata', () => {
    expect(extractSessionId('call-9', { sessionId: 'chat-session-1' })).toBe(
      'chat-session-1',
    )
  })

  it('falls back to a voice_ prefix when metadata is missing or not a string', () => {
    expect(extractSessionId('call-9')).toBe('voice_call-9')
    expect(extractSessionId('call-9', { sessionId: 42 })).toBe('voice_call-9')
    expect(extractSessionId('call-9', { other: 'x' })).toBe('voice_call-9')
  })

  it('formats transcripts for the N8N chat workflow', () => {
    expect(
      formatTranscriptForN8n('hello there', 'voice_call-9', { vapiCallId: 'call-9' }),
    ).toEqual({
      action: 'sendMessage',
      sessionId: 'voice_call-9',
      chatInput: 'hello there',
      source: 'voice',
      metadata: { vapiCallId: 'call-9' },
    })
  })

  it('wraps function and error webhook payloads', () => {
    expect(createFunctionResponse({ ok: true })).toEqual({ result: { ok: true } })
    expect(createErrorResponse('missing tool')).toEqual({ error: 'missing tool' })
  })

  it('treats blank public key or assistant id as unconfigured', () => {
    expect(isVapiConfigured()).toBe(false)
    expect(getVapiConfig()).toEqual({ publicKey: '', assistantId: '' })

    process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY = '   '
    process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID = 'asst_1'
    expect(isVapiConfigured()).toBe(false)

    process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY = 'pk_live'
    process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID = 'asst_1'
    expect(isVapiConfigured()).toBe(true)
    expect(getVapiConfig()).toEqual({
      publicKey: 'pk_live',
      assistantId: 'asst_1',
    })
  })
})
