import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isMockN8nEnabled: vi.fn(),
  isN8nOutboundDisabled: vi.fn(),
  fetchRag: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: { error?: string }) => Boolean(result && 'error' in result),
}))

vi.mock('@/lib/n8n-runtime-flags', () => ({
  isMockN8nEnabled: mocks.isMockN8nEnabled,
  isN8nOutboundDisabled: mocks.isN8nOutboundDisabled,
}))

vi.mock('@/lib/rag-query', () => ({
  fetchRagContextForEmailQueryWithDiagnostics: mocks.fetchRag,
}))

import { GET } from './route'
import { KNOWLEDGE_GOVERNANCE_STATUS } from '@/lib/knowledge-source-manifest'
import { routePolicyFor } from '@/lib/knowledge-governance'

describe('GET /api/admin/rag-health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isMockN8nEnabled.mockReturnValue(false)
    mocks.isN8nOutboundDisabled.mockReturnValue(false)
    mocks.fetchRag.mockResolvedValue({ block: 'AmaduTown helps clients.', diagnostics: { http: 200 } })
  })

  it('rejects non-admins before checking n8n flags', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(new NextRequest('http://localhost/api/admin/rag-health'))

    expect(response.status).toBe(401)
    expect(mocks.isMockN8nEnabled).not.toHaveBeenCalled()
    expect(mocks.fetchRag).not.toHaveBeenCalled()
  })

  it('skips the probe when mock n8n wins over outbound disablement', async () => {
    mocks.isMockN8nEnabled.mockReturnValue(true)
    mocks.isN8nOutboundDisabled.mockReturnValue(true)

    const response = await GET(new NextRequest('http://localhost/api/admin/rag-health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: false,
      skipped: true,
      reason: 'MOCK_N8N',
      governance: KNOWLEDGE_GOVERNANCE_STATUS,
    })
    expect(mocks.fetchRag).not.toHaveBeenCalled()
  })

  it('reports outbound disablement when mock mode is off', async () => {
    mocks.isN8nOutboundDisabled.mockReturnValue(true)

    const response = await GET(new NextRequest('http://localhost/api/admin/rag-health'))

    expect(await response.json()).toMatchObject({
      ok: false,
      skipped: true,
      reason: 'N8N_DISABLE_OUTBOUND',
    })
  })

  it('falls back to the voice route and the default health query', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/rag-health?route=not-a-route&q=%20%20'))
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.route).toBe('public_chatbot_voice')
    expect(body.policy).toEqual(routePolicyFor('public_chatbot_voice'))
    expect(body.preview).toBe('AmaduTown helps clients.')
    expect(mocks.fetchRag).toHaveBeenCalledWith(
      'Health check: one short paragraph on AmaduTown services and how you work with clients.',
      { ignoreEmailRagEnabled: true, route: 'public_chatbot_voice' },
    )
  })

  it('keeps a supported route, trims the query, and marks an empty block unsuccessful', async () => {
    mocks.fetchRag.mockResolvedValue({ block: '', diagnostics: { empty: true } })

    const response = await GET(new NextRequest(
      'http://localhost/api/admin/rag-health?route=outreach_email&q=%20pricing%20',
    ))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.route).toBe('outreach_email')
    expect(body.policy).toEqual(routePolicyFor('outreach_email'))
    expect(body.diagnostics).toEqual({ empty: true })
    expect(body.message).toContain('RAG returned empty')
    expect(mocks.fetchRag).toHaveBeenCalledWith('pricing', {
      ignoreEmailRagEnabled: true,
      route: 'outreach_email',
    })
  })

  it('adds an ellipsis only when the preview is longer than 500 characters', async () => {
    mocks.fetchRag.mockResolvedValue({ block: 'x'.repeat(501), diagnostics: {} })

    const response = await GET(new NextRequest('http://localhost/api/admin/rag-health?route=admin_internal'))
    const body = await response.json()

    expect(body.preview).toBe(`${'x'.repeat(500)}…`)
    expect(body.route).toBe('admin_internal')
  })
})
