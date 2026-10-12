import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  collectLiveSocialTopicCoverage: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: unknown) => Boolean(value && typeof value === 'object' && 'error' in value),
}))
vi.mock('@/lib/social-topic-source-coverage', () => ({ collectLiveSocialTopicCoverage: mocks.collectLiveSocialTopicCoverage }))

import { GET } from './route'

describe('GET /api/admin/social-content/source-coverage', () => {
  beforeEach(() => {
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin' } })
    mocks.collectLiveSocialTopicCoverage.mockResolvedValue({ status: 'ready' })
    vi.stubEnv('VERCEL_ENV', 'preview')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('serves the read-only synthetic candidate fixture only on an enabled non-production surface', async () => {
    const response = await GET(new NextRequest('https://preview.example.test/api/admin/social-content/source-coverage?qa_fixture=durable-candidates'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.qa_fixture).toEqual({
      id: 'durable-candidates',
      synthetic: true,
      preview_only: true,
      read_only: true,
      external_execution_enabled: false,
    })
    expect(payload.coverage.trend_work_relevance.candidates).toHaveLength(3)
    expect(mocks.collectLiveSocialTopicCoverage).not.toHaveBeenCalled()
  })

  it('refuses the synthetic fixture in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const response = await GET(new NextRequest('https://portfolio.example.test/api/admin/social-content/source-coverage?qa_fixture=durable-candidates'))

    expect(response.status).toBe(404)
    expect(mocks.collectLiveSocialTopicCoverage).not.toHaveBeenCalled()
  })

  it('keeps the normal approved coverage read unchanged when no fixture is requested', async () => {
    const response = await GET(new NextRequest('https://preview.example.test/api/admin/social-content/source-coverage'))

    expect(response.status).toBe(200)
    expect(mocks.collectLiveSocialTopicCoverage).toHaveBeenCalledWith({ persist: false })
  })
})

