/**
 * GET /api/admin/outreach/leads/[id]/preview-prompt — Phase 2
 *
 * Pinning behavior: validates auth, channel/templateKey scoping, DNC gating,
 * and that the response carries every key the WhyThisDraftModal "preview"
 * view depends on. Uses a stubbed buildOutreachPromptContext so we can run
 * without hitting Supabase / OpenAI.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildOutreachPromptContext: vi.fn(),
  isInAppOutreachGenerationEnabled: vi.fn(),
  userPromptFor: vi.fn(),
  contactSelectSingle: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/outreach-queue-generator', () => ({
  buildOutreachPromptContext: mocks.buildOutreachPromptContext,
  isInAppOutreachGenerationEnabled: mocks.isInAppOutreachGenerationEnabled,
  userPromptFor: mocks.userPromptFor,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mocks.contactSelectSingle(),
        }),
      }),
    }),
  },
}))

import { GET } from './route'

function makeReq(qs: string) {
  return new NextRequest(
    `http://localhost/api/admin/outreach/leads/42/preview-prompt?${qs}`,
    { method: 'GET' },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verifyAdmin.mockResolvedValue({ id: 'admin-1' })
  mocks.isAuthError.mockReturnValue(false)
  mocks.isInAppOutreachGenerationEnabled.mockReturnValue(true)
  mocks.userPromptFor.mockImplementation((channel: 'email' | 'linkedin') =>
    channel === 'linkedin' ? 'LI USER PROMPT' : 'EMAIL USER PROMPT',
  )
  mocks.contactSelectSingle.mockResolvedValue({
    data: { id: 42, do_not_contact: false, removed_at: null },
    error: null,
  })
  mocks.buildOutreachPromptContext.mockResolvedValue({
    contact: {},
    systemPrompt: 'ASSEMBLED SYSTEM PROMPT',
    promptRow: { name: 'Cold Outreach v4', version: 4 },
    model: 'gpt-4o-mini',
    provider: 'openai',
    temperature: 0.75,
    maxTokens: 600,
    contextSizes: {
      researchBrief: 1234,
      socialProof: 567,
      meetingSnippet: 0,
      meetingTextSource: 'none' as const,
      meetingActionItems: 0,
      pineconeChars: 800,
      priorChatPresent: false,
      pineconeBlockHash: 'abc123abc123',
      priorOutreachChars: 0,
      priorOutreachEntries: 0,
      priorOutreachHasInbound: false,
      valueEvidenceChars: 0,
      valueEvidenceRows: 0,
      ragQueryChars: 100,
      ragSkippedReason: null,
      ragAttempted: true,
      ragErrorClass: null,
      ragHttpStatus: null,
      ragLatencyMs: 42,
      ragEmptyResponse: false,
    },
  })
})

describe('GET /api/admin/outreach/leads/[id]/preview-prompt', () => {
  it('returns the assembled prompt + all preview metadata for an email request', async () => {
    const res = await GET(makeReq('channel=email&templateKey=email_cold_outreach'), {
      params: { id: '42' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.systemPrompt).toBe('ASSEMBLED SYSTEM PROMPT')
    expect(body.userPrompt).toBe('EMAIL USER PROMPT')
    expect(body.channel).toBe('email')
    expect(body.templateKey).toBe('email_cold_outreach')
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.provider).toBe('openai')
    expect(body.promptVersion).toBe(4)
    expect(body.promptName).toBe('Cold Outreach v4')
    expect(body.contextSizes).toMatchObject({
      researchBriefChars: 1234,
      socialProofChars: 567,
      pineconeChars: 800,
      priorChatPresent: false,
      pineconeBlockHash: 'abc123abc123',
    })
  })

  it('rejects a templateKey that does not match the channel', async () => {
    // email_cold_outreach is not a LinkedIn template → 400
    const res = await GET(
      makeReq('channel=linkedin&templateKey=email_cold_outreach'),
      { params: { id: '42' } },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as Record<string, unknown>
    expect(String(body.error)).toContain("'email_cold_outreach'")
  })

  it('returns 401 when verifyAdmin says unauthorized', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    const res = await GET(makeReq('channel=email'), { params: { id: '42' } })
    expect(res.status).toBe(401)
  })

  it('returns 400 for do-not-contact leads', async () => {
    mocks.contactSelectSingle.mockResolvedValue({
      data: { id: 42, do_not_contact: true, removed_at: null },
      error: null,
    })
    const res = await GET(makeReq('channel=email'), { params: { id: '42' } })
    expect(res.status).toBe(400)
    const body = (await res.json()) as Record<string, unknown>
    expect(String(body.error)).toContain('do-not-contact')
  })

  it('returns 503 when in-app generation is disabled', async () => {
    mocks.isInAppOutreachGenerationEnabled.mockReturnValue(false)
    const res = await GET(makeReq('channel=email'), { params: { id: '42' } })
    expect(res.status).toBe(503)
  })
})
