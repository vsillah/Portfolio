import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { DELETE } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/video-generation/jobs/job-1', {
    method: 'DELETE',
  })
}

describe('DELETE /api/admin/video-generation/jobs/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth before mutating a job', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await DELETE(request(), { params: { id: 'job-1' } })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing job id', async () => {
    const response = await DELETE(request(), { params: { id: '' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Job ID is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('soft-deletes only undeleted jobs', async () => {
    const is = vi.fn().mockResolvedValue({ error: null })
    const eq = vi.fn(() => ({ is }))
    const update = vi.fn(() => ({ eq }))
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('video_generation_jobs')
      return { update }
    })

    const response = await DELETE(request(), { params: { id: 'job-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      deleted_at: expect.any(String),
    }))
    expect(eq).toHaveBeenCalledWith('id', 'job-1')
    expect(is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns 500 when the soft-delete write fails', async () => {
    mocks.from.mockReturnValue({
      update: () => ({
        eq: () => ({
          is: vi.fn().mockResolvedValue({ error: { message: 'db down' } }),
        }),
      }),
    })

    const response = await DELETE(request(), { params: { id: 'job-1' } })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to delete job' })
  })
})
