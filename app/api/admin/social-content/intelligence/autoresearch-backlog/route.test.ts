import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { GET } from './route'

function request(url = 'http://localhost/api/admin/social-content/intelligence/autoresearch-backlog') {
  return new Request(url, {
    headers: { authorization: 'Bearer admin-token' },
  })
}

describe('/api/admin/social-content/intelligence/autoresearch-backlog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns a read-only AutoResearch backlog projection without callable actions', async () => {
    const response = await GET(request() as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.summary).toEqual({
      total: 2,
      readyForInternalHandoff: 1,
      blockedOrManual: 2,
      callableExternalActions: 0,
    })
    expect(body.side_effects).toEqual({
      provider_call: false,
      slack_send: false,
      cron_activation: false,
      migration: false,
      publish: false,
      schedule: false,
      upload: false,
      production_mutation: false,
    })
    expect(body.callable_external_actions).toEqual([])
    expect(body.items[0]).toMatchObject({
      id: 'autoresearch-agentified-agt-x-01',
      firstBlockedOrPendingGate: 'final_submission',
      callableExternalActions: [],
      campaign: {
        slug: 'agentified-trust-scale-2026-07',
        phase: 'tease',
      },
    })
    expect(body.items[0].sourcePacketPaths).toContain('agentified/campaign/portfolio-campaign-packet.json')
  })
})
