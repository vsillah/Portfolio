import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  sendToN8n: vi.fn(),
  sendDiagnosticToN8n: vi.fn(),
  generateSessionId: vi.fn(),
  triggerDiagnosticCompletionWebhook: vi.fn(),
  triggerLeadQualificationWebhook: vi.fn(),
  saveDiagnosticAudit: vi.fn(),
  getDiagnosticAuditBySession: vi.fn(),
  fetchConversationContext: vi.fn(),
  getSystemPrompt: vi.fn(),
  fetchClientContext: vi.fn(),
  isIpRateLimited: vi.fn(),
  getClientIpFromRequest: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/n8n', () => ({
  sendToN8n: mocks.sendToN8n,
  sendDiagnosticToN8n: mocks.sendDiagnosticToN8n,
  generateSessionId: mocks.generateSessionId,
  triggerDiagnosticCompletionWebhook: mocks.triggerDiagnosticCompletionWebhook,
  triggerLeadQualificationWebhook: mocks.triggerLeadQualificationWebhook,
}))

vi.mock('@/lib/diagnostic', () => ({
  saveDiagnosticAudit: mocks.saveDiagnosticAudit,
  getDiagnosticAuditBySession: mocks.getDiagnosticAuditBySession,
  linkDiagnosticToContact: vi.fn(),
}))

vi.mock('@/lib/chat-context', () => ({
  fetchConversationContext: mocks.fetchConversationContext,
}))

vi.mock('@/lib/system-prompts', () => ({
  getSystemPrompt: mocks.getSystemPrompt,
}))

vi.mock('@/lib/chat-client-context', () => ({
  fetchClientContext: mocks.fetchClientContext,
  formatClientContextForAI: vi.fn(),
}))

vi.mock('@/lib/simple-ip-rate-limit', () => ({
  isIpRateLimited: mocks.isIpRateLimited,
  getClientIpFromRequest: mocks.getClientIpFromRequest,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>, ip = 'chat-ip-default') {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

function mockSessionTables(existing: { id: string } | null = { id: 'sess-1' }) {
  const single = vi.fn().mockResolvedValue({ data: existing, error: existing ? null : { message: 'not found' } })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  const insert = vi.fn().mockResolvedValue({ error: null })
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const messageInsert = vi.fn().mockResolvedValue({ error: null })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'chat_sessions') return { select, insert, update }
    if (table === 'chat_messages') return { insert: messageInsert }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { select, insert, messageInsert }
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.isIpRateLimited.mockReturnValue(false)
    mocks.getClientIpFromRequest.mockReturnValue('chat-ip-default')
    mocks.fetchConversationContext.mockResolvedValue(null)
    mocks.getSystemPrompt.mockResolvedValue(null)
    mocks.sendToN8n.mockResolvedValue({
      response: 'Hello from n8n',
      escalated: false,
      metadata: {},
    })
    mocks.sendDiagnosticToN8n.mockResolvedValue({
      response: 'Starting the diagnostic.',
      isComplete: false,
      diagnosticData: null,
      progress: { completedCategories: [], questionsAsked: [], responsesReceived: {} },
      currentCategory: 'business_challenges',
      metadata: {},
    })
    mocks.getDiagnosticAuditBySession.mockResolvedValue({ data: null })
    mocks.saveDiagnosticAudit.mockResolvedValue({ id: 'audit-1', error: null })
    mocks.generateSessionId.mockReturnValue('generated-session-id')
    mockSessionTables()
  })

  it('rejects an empty message before writing a session', async () => {
    const response = await POST(makeRequest({ message: '', sessionId: 'session01' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid request' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.sendToN8n).not.toHaveBeenCalled()
  })

  it('rejects an invalid session id before querying chat_sessions', async () => {
    const response = await POST(makeRequest({ message: 'hello there', sessionId: 'bad' }))

    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.sendToN8n).not.toHaveBeenCalled()
  })

  it('returns 429 when the chat_message bucket is rate limited', async () => {
    mocks.isIpRateLimited.mockReturnValue(true)

    const response = await POST(makeRequest({ message: 'hello there', sessionId: 'session01' }))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: "You're sending messages too quickly. Please wait a moment.",
      retriable: true,
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not trust a client-supplied userId when there is no Authorization header', async () => {
    const response = await POST(makeRequest({
      message: 'hello there',
      sessionId: 'session01',
      userId: '550e8400-e29b-41d4-a716-446655440000',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sessionId).toBe('session01')
    expect(body.diagnosticMode).toBe(false)
    expect(mocks.fetchClientContext).not.toHaveBeenCalled()
    expect(mocks.sendToN8n).toHaveBeenCalledWith(expect.objectContaining({
      message: 'hello there',
      sessionId: 'session01',
      diagnosticMode: false,
    }))
    expect(mocks.sendDiagnosticToN8n).not.toHaveBeenCalled()
  })

  it('starts diagnostic mode from intent phrases and does not call the chat n8n path', async () => {
    const response = await POST(makeRequest({
      message: 'Can you run an audit of my operations?',
      sessionId: 'session01',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.diagnosticMode).toBe(true)
    expect(body.diagnosticAuditId).toBe('audit-1')
    expect(mocks.saveDiagnosticAudit).toHaveBeenCalledWith('session01', { status: 'in_progress' })
    expect(mocks.sendDiagnosticToN8n).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session01',
      diagnosticAuditId: 'audit-1',
      message: 'Can you run an audit of my operations?',
    }))
    expect(mocks.sendToN8n).not.toHaveBeenCalled()
  })
})
