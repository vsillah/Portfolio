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
  linkDiagnosticToContact: vi.fn(),
  fetchConversationContext: vi.fn(),
  getSystemPrompt: vi.fn(),
  fetchClientContext: vi.fn(),
  formatClientContextForAI: vi.fn(),
  isIpRateLimited: vi.fn(),
  getClientIpFromRequest: vi.fn(),
  findOrCreateContactByEmail: vi.fn(),
  getAuthUserPrimaryEmail: vi.fn(),
  createChatEscalation: vi.fn(),
  getAuthUser: vi.fn(),
  createClient: vi.fn(),
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
  linkDiagnosticToContact: mocks.linkDiagnosticToContact,
}))

vi.mock('@/lib/chat-context', () => ({
  fetchConversationContext: mocks.fetchConversationContext,
}))

vi.mock('@/lib/system-prompts', () => ({
  getSystemPrompt: mocks.getSystemPrompt,
}))

vi.mock('@/lib/chat-client-context', () => ({
  fetchClientContext: mocks.fetchClientContext,
  formatClientContextForAI: mocks.formatClientContextForAI,
}))

vi.mock('@/lib/find-or-create-contact', () => ({
  findOrCreateContactByEmail: mocks.findOrCreateContactByEmail,
}))

vi.mock('@/lib/auth-user-email', () => ({
  getAuthUserPrimaryEmail: mocks.getAuthUserPrimaryEmail,
}))

vi.mock('@/lib/chat-escalation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/chat-escalation')>()
  return {
    ...actual,
    createChatEscalation: mocks.createChatEscalation,
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/simple-ip-rate-limit', () => ({
  isIpRateLimited: mocks.isIpRateLimited,
  getClientIpFromRequest: mocks.getClientIpFromRequest,
}))

import { POST } from './route'

function makeRequest(
  body: Record<string, unknown>,
  {
    ip = 'chat-ip-default',
    authorization,
  }: { ip?: string; authorization?: string } = {},
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
  }
  if (authorization) headers.authorization = authorization
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers,
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
    mocks.linkDiagnosticToContact.mockResolvedValue(undefined)
    mocks.generateSessionId.mockReturnValue('generated-session-id')
    mocks.findOrCreateContactByEmail.mockResolvedValue(42)
    mocks.getAuthUserPrimaryEmail.mockResolvedValue(null)
    mocks.createChatEscalation.mockResolvedValue(9)
    mocks.formatClientContextForAI.mockReturnValue('CLIENT CONTEXT')
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getAuthUser },
    })
    mocks.getAuthUser.mockResolvedValue({ data: { user: null } })
    mocks.triggerDiagnosticCompletionWebhook.mockResolvedValue({ triggered: true })
    mocks.triggerLeadQualificationWebhook.mockResolvedValue({ triggered: true })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
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

const COMPLETED_AUDIT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('POST /api/chat diagnostic completion and side effects', () => {
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
    mocks.saveDiagnosticAudit.mockResolvedValue({ id: COMPLETED_AUDIT_ID, error: null })
    mocks.linkDiagnosticToContact.mockResolvedValue(undefined)
    mocks.generateSessionId.mockReturnValue('generated-session-id')
    mocks.findOrCreateContactByEmail.mockResolvedValue(42)
    mocks.getAuthUserPrimaryEmail.mockResolvedValue(null)
    mocks.createChatEscalation.mockResolvedValue(9)
    mocks.formatClientContextForAI.mockReturnValue('CLIENT CONTEXT')
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getAuthUser },
    })
    mocks.getAuthUser.mockResolvedValue({ data: { user: null } })
    mocks.triggerDiagnosticCompletionWebhook.mockResolvedValue({ triggered: true })
    mocks.triggerLeadQualificationWebhook.mockResolvedValue({ triggered: true })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mockSessionTables()
  })

  it('links a completed diagnostic to a contact and fires both webhooks', async () => {
    mocks.sendDiagnosticToN8n.mockResolvedValue({
      response: 'Here is your summary.',
      isComplete: true,
      diagnosticData: { diagnostic_summary: 'Ops bottlenecks identified.' },
      progress: { completedCategories: ['business_challenges'], questionsAsked: [], responsesReceived: {} },
      currentCategory: 'business_challenges',
      metadata: {},
    })

    const response = await POST(makeRequest({
      message: 'That covers my current operations.',
      sessionId: 'session01',
      diagnosticMode: true,
      diagnosticAuditId: COMPLETED_AUDIT_ID,
      visitorEmail: 'lead@example.com',
      visitorName: 'Pat',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.diagnosticComplete).toBe(true)
    expect(mocks.findOrCreateContactByEmail).toHaveBeenCalledWith(
      'lead@example.com',
      expect.objectContaining({ name: 'Pat', leadSource: 'website_form' }),
    )
    expect(mocks.linkDiagnosticToContact).toHaveBeenCalledWith(COMPLETED_AUDIT_ID, 42)
    expect(mocks.triggerLeadQualificationWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'lead@example.com',
        source: 'chat_diagnostic',
        submissionId: '42',
      }),
    )
    expect(mocks.triggerDiagnosticCompletionWebhook).toHaveBeenCalledWith(
      COMPLETED_AUDIT_ID,
      expect.objectContaining({ diagnostic_summary: 'Ops bottlenecks identified.' }),
      { email: 'lead@example.com', name: 'Pat' },
    )
  })

  it('skips contact linking when diagnostic completion is rate limited but still fires the completion webhook', async () => {
    mocks.isIpRateLimited.mockImplementation((bucket: string) => bucket === 'chat_diagnostic_complete')
    mocks.sendDiagnosticToN8n.mockResolvedValue({
      response: 'Done.',
      isComplete: true,
      diagnosticData: { diagnostic_summary: 'Complete.' },
      progress: { completedCategories: [], questionsAsked: [], responsesReceived: {} },
      metadata: {},
    })

    const response = await POST(makeRequest({
      message: 'That covers my current operations.',
      sessionId: 'session01',
      diagnosticMode: true,
      diagnosticAuditId: COMPLETED_AUDIT_ID,
      visitorEmail: 'lead@example.com',
    }))

    expect(response.status).toBe(200)
    expect(mocks.findOrCreateContactByEmail).not.toHaveBeenCalled()
    expect(mocks.linkDiagnosticToContact).not.toHaveBeenCalled()
    expect(mocks.triggerLeadQualificationWebhook).not.toHaveBeenCalled()
    expect(mocks.triggerDiagnosticCompletionWebhook).toHaveBeenCalled()
  })

  it('does not run completion side effects for fallback diagnostic responses', async () => {
    mocks.sendDiagnosticToN8n.mockResolvedValue({
      response: 'Please try again.',
      isComplete: true,
      diagnosticData: { diagnostic_summary: 'partial' },
      progress: { completedCategories: [], questionsAsked: [], responsesReceived: {} },
      metadata: { fallback: true },
    })

    await POST(makeRequest({
      message: 'That covers my current operations.',
      sessionId: 'session01',
      diagnosticMode: true,
      diagnosticAuditId: COMPLETED_AUDIT_ID,
      visitorEmail: 'lead@example.com',
    }))

    expect(mocks.findOrCreateContactByEmail).not.toHaveBeenCalled()
    expect(mocks.triggerDiagnosticCompletionWebhook).not.toHaveBeenCalled()
  })

  it('loads client context only after a Bearer token resolves to a user', async () => {
    mocks.getAuthUser.mockResolvedValue({ data: { user: { id: 'user-abc' } } })
    mocks.fetchClientContext.mockResolvedValue({ project: 'ops' })

    await POST(makeRequest(
      { message: 'hello there', sessionId: 'session01' },
      { authorization: 'Bearer user-jwt' },
    ))

    expect(mocks.getAuthUser).toHaveBeenCalledWith('user-jwt')
    expect(mocks.fetchClientContext).toHaveBeenCalledWith('user-abc')
    expect(mocks.sendToN8n).toHaveBeenCalledWith(expect.objectContaining({
      clientContext: 'CLIENT CONTEXT',
    }))
  })

  it('persists a chat escalation when n8n marks the turn as escalated', async () => {
    mocks.sendToN8n.mockResolvedValue({
      response: 'Connecting you with a human.',
      escalated: true,
      metadata: {},
    })

    const response = await POST(makeRequest({
      message: 'I need to talk to a person please',
      sessionId: 'session01',
      visitorEmail: 'lead@example.com',
      visitorName: 'Pat',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.escalated).toBe(true)
    expect(mocks.createChatEscalation).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session01',
      source: 'text',
      reason: 'user_requested_human',
      visitorName: 'Pat',
      visitorEmail: 'lead@example.com',
    }))
  })

  it('extracts a valid Calendly schedule action from the assistant text', async () => {
    mocks.sendToN8n.mockResolvedValue({
      response: 'Book here {"action":"schedule_meeting","calendlyUrl":"https://calendly.com/amadutown/intro"} thanks',
      escalated: false,
      metadata: {},
    })

    const response = await POST(makeRequest({
      message: 'Can we schedule a meeting next week?',
      sessionId: 'session01',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.metadata).toEqual({
      action: 'schedule_meeting',
      calendlyUrl: 'https://calendly.com/amadutown/intro',
    })
    expect(body.response).toBe('Book here  thanks')
  })

  it('strips an invalid Calendly URL from metadata before returning it', async () => {
    mocks.sendToN8n.mockResolvedValue({
      response: 'Let us meet',
      escalated: false,
      metadata: {
        action: 'schedule_meeting',
        calendlyUrl: 'https://evil.example/not-calendly',
      },
    })

    const response = await POST(makeRequest({
      message: 'Can we schedule a meeting next week?',
      sessionId: 'session01',
    }))
    const body = await response.json()

    expect(body.metadata.action).toBeUndefined()
    expect(body.metadata.calendlyUrl).toBeUndefined()
  })
})
