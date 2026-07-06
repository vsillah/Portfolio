import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('GET /api/admin/social-content/calibration-library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns reusable LinkedIn calibration references without side effects', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/calibration-library?platform=linkedin'))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toMatchObject({
      source: 'approved_calibration_library',
      side_effects: {
        provider_generation: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
    expect(json.references).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'linkedin-builder-insight-production-readiness',
        platform: 'linkedin',
        source_type: 'voice_guide_reference',
        provenance: 'docs/linkedin-voice.md',
      }),
      expect.objectContaining({
        id: 'linkedin-governed-agent-work',
        platform: 'linkedin',
        source_type: 'operator_approved_pattern',
      }),
    ]))
  })

  it('requires admin auth before exposing calibration references', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/calibration-library'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
  })

  it('returns an empty set for unsupported platforms', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/calibration-library?platform=tiktok'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      references: [],
      source: 'approved_calibration_library',
    })
  })
})
