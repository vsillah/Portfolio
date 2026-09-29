import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  getAgentQualitySummary: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: { error?: string }) => Boolean(result && 'error' in result),
}))

vi.mock('@/lib/agent-evaluations', () => ({
  getAgentQualitySummary: mocks.getAgentQualitySummary,
}))

import { GET } from './route'

function get(query = '', agentKey = 'chief-of-staff') {
  return GET(
    new NextRequest(`http://localhost/api/admin/agents/evaluations/${agentKey}${query}`),
    { params: { agentKey } },
  )
}

describe('GET /api/admin/agents/evaluations/[agentKey]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.getAgentQualitySummary.mockResolvedValue({ agentKey: 'chief-of-staff', score: 90 })
  })

  it('rejects non-admins before loading a summary', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await get()

    expect(response.status).toBe(401)
    expect(mocks.getAgentQualitySummary).not.toHaveBeenCalled()
  })

  it('rejects a blank agent key', async () => {
    const response = await get('', '   ')

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'agentKey is required' })
    expect(mocks.getAgentQualitySummary).not.toHaveBeenCalled()
  })

  it('defaults a missing, zero, or non-numeric window to 24 hours', async () => {
    await get()
    await get('?window_hours=0')
    await get('?window_hours=-4')
    await get('?window_hours=abc')

    expect(mocks.getAgentQualitySummary.mock.calls.map((call) => call[0])).toEqual([
      { agentKey: 'chief-of-staff', windowHours: 24 },
      { agentKey: 'chief-of-staff', windowHours: 24 },
      { agentKey: 'chief-of-staff', windowHours: 24 },
      { agentKey: 'chief-of-staff', windowHours: 24 },
    ])
  })

  it('keeps a positive window and spreads the summary', async () => {
    const response = await get('?window_hours=12.5', '  n8n-automation  ')
    const body = await response.json()

    expect(body).toEqual({ ok: true, agentKey: 'chief-of-staff', score: 90 })
    expect(mocks.getAgentQualitySummary).toHaveBeenCalledWith({
      agentKey: 'n8n-automation',
      windowHours: 12.5,
    })
  })

  it('returns an error message and hides a non-Error throw', async () => {
    mocks.getAgentQualitySummary.mockRejectedValueOnce(new Error('rubric missing'))
    const failed = await get()
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'rubric missing' })

    mocks.getAgentQualitySummary.mockRejectedValueOnce('nope')
    const hidden = await get()
    expect(hidden.status).toBe(500)
    expect(await hidden.json()).toEqual({ error: 'Failed to load agent evaluation detail' })
  })
})
