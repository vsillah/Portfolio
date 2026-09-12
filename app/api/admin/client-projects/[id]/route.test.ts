import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  getRoadmapBundleForProject: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/client-ai-ops-roadmap-db', () => ({
  getRoadmapBundleForProject: mocks.getRoadmapBundleForProject,
}))

vi.mock('@/lib/client-ai-ops-readiness-contract', () => ({
  buildClientAiOpsReadinessContract: vi.fn(),
}))

import { GET, PATCH } from './route'

function params(id = 'project-1') {
  return { params: Promise.resolve({ id }) }
}

function makeGet(id = 'project-1') {
  return new NextRequest(`http://localhost/api/admin/client-projects/${id}`)
}

function makePatch(body: unknown, id = 'project-1') {
  return new NextRequest(`http://localhost/api/admin/client-projects/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/client-projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGet(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the project is missing', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGet(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Client project not found' })
    expect(mocks.getRoadmapBundleForProject).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/client-projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before mutating', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(
      makePatch({ project_status: 'in_progress' }),
      params(),
    )

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects bodies with no allowlisted fields', async () => {
    const response = await PATCH(
      makePatch({
        client_name: 'Acme',
        contact_submission_id: 99,
        total_value: 5000,
      }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No valid fields to update',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates only allowlisted fields and drops mass-assignment keys', async () => {
    const updated = { id: 'project-1', project_status: 'in_progress', slack_channel: '#ops' }
    const single = vi.fn().mockResolvedValue({ data: updated, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(
      makePatch({
        project_status: 'in_progress',
        slack_channel: '#ops',
        client_name: 'should-not-write',
        contact_submission_id: 99,
      }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ project: updated })
    expect(update).toHaveBeenCalledWith({
      project_status: 'in_progress',
      slack_channel: '#ops',
    })
    expect(eq).toHaveBeenCalledWith('id', 'project-1')
  })
})
