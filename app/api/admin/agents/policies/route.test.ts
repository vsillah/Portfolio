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

function request() {
  return new Request('http://localhost/api/admin/agents/policies', {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/policies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns runtime policies, approval gates, and budget rules', async () => {
    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.policies).toEqual(expect.arrayContaining([
      expect.objectContaining({ runtime: 'codex' }),
      expect.objectContaining({ runtime: 'n8n' }),
    ]))
    expect(body.approval_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'send_email' }),
    ]))
    expect(body.budget_rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'llm_n8n_per_call',
        runtime: 'n8n',
        scope: 'per_call',
      }),
      expect.objectContaining({
        key: 'llm_default_per_call',
        runtime: 'any',
      }),
    ]))
  })
})
