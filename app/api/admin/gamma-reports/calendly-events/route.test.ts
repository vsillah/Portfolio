import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { GET } from './route'
import {
  CALENDLY_EVENT_KEYS,
  DEFAULT_CALENDLY_EVENT_FOR_REPORT_TYPE,
} from '@/lib/calendly-events'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/gamma-reports/calendly-events')
}

describe('GET /api/admin/gamma-reports/calendly-events', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env = { ...originalEnv }
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns the auth error when the caller is not an admin', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns catalog events with resolved URLs and report-type defaults', async () => {
    process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL = 'https://calendly.com/atas/discovery'
    process.env.CALENDLY_ONBOARDING_CALL_URL = 'https://calendly.com/atas/onboarding'
    delete process.env.CALENDLY_KICKOFF_MEETING_URL

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.defaultsByReportType).toEqual(DEFAULT_CALENDLY_EVENT_FOR_REPORT_TYPE)
    expect(body.events.map((event: { key: string }) => event.key)).toEqual([...CALENDLY_EVENT_KEYS])

    const discovery = body.events.find((event: { key: string }) => event.key === 'discovery_call')
    const onboarding = body.events.find((event: { key: string }) => event.key === 'onboarding')
    const kickoff = body.events.find((event: { key: string }) => event.key === 'kickoff')

    expect(discovery).toMatchObject({
      url: 'https://calendly.com/atas/discovery',
      isConfigured: true,
      envVar: 'NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL',
    })
    expect(onboarding).toMatchObject({
      url: 'https://calendly.com/atas/onboarding',
      isConfigured: true,
    })
    expect(kickoff).toMatchObject({
      url: 'https://calendly.com/atas/discovery',
      isConfigured: false,
    })
  })
})
