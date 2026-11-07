import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  getGenerationStatus: vi.fn(),
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

vi.mock('@/lib/gamma-client', () => ({
  getGenerationStatus: mocks.getGenerationStatus,
}))

import { POST } from './route'

function params(id = 'report-1') {
  return { params: { id } }
}

function makeRequest(id = 'report-1') {
  return new NextRequest(`http://localhost/api/admin/gamma-reports/${id}/reconcile`, {
    method: 'POST',
  })
}

function mockReportRow(row: Record<string, unknown> | null, updateResult?: { error: { code?: string; message?: string } | null }) {
  const single = vi.fn().mockResolvedValue({
    data: row,
    error: row ? null : { code: 'PGRST116' },
  })
  const selectEq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq: selectEq })
  const updateEq = vi.fn().mockResolvedValue(updateResult ?? { error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  mocks.from.mockReturnValue({ select, update })
  return { selectEq, update, updateEq }
}

describe('POST /api/admin/gamma-reports/[id]/reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns the auth error when the caller is not an admin', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.getGenerationStatus).not.toHaveBeenCalled()
  })

  it('returns 404 when the report row is missing', async () => {
    mockReportRow(null)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Gamma report not found' })
    expect(mocks.getGenerationStatus).not.toHaveBeenCalled()
  })

  it('returns 400 when the row has no generation id', async () => {
    mockReportRow({
      id: 'report-1',
      status: 'failed',
      gamma_generation_id: null,
      gamma_url: null,
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Row has no gamma_generation_id; nothing to reconcile',
    })
    expect(mocks.getGenerationStatus).not.toHaveBeenCalled()
  })

  it('no-ops when the row is already completed with a url', async () => {
    mockReportRow({
      id: 'report-1',
      status: 'completed',
      gamma_generation_id: 'gen-1',
      gamma_url: 'https://gamma.app/docs/done',
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      reportId: 'report-1',
      status: 'completed',
      gammaUrl: 'https://gamma.app/docs/done',
      action: 'noop',
    })
    expect(mocks.getGenerationStatus).not.toHaveBeenCalled()
  })

  it('recovers a completed Gamma generation onto the row', async () => {
    const { update } = mockReportRow({
      id: 'report-1',
      status: 'failed',
      gamma_generation_id: 'gen-1',
      gamma_url: null,
    })
    mocks.getGenerationStatus.mockResolvedValue({
      generationId: 'gen-1',
      status: 'completed',
      gammaUrl: 'https://gamma.app/docs/recovered',
      credits: { deducted: 1, remaining: 9 },
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      reportId: 'report-1',
      status: 'completed',
      gammaUrl: 'https://gamma.app/docs/recovered',
      action: 'recovered',
      credits: { deducted: 1, remaining: 9 },
    })
    expect(update).toHaveBeenCalledWith({
      status: 'completed',
      gamma_url: 'https://gamma.app/docs/recovered',
      error_message: null,
    })
  })

  it('returns 409 when another completed audit_summary already exists', async () => {
    mockReportRow(
      {
        id: 'report-1',
        status: 'failed',
        gamma_generation_id: 'gen-1',
        gamma_url: null,
      },
      { error: { code: '23505', message: 'duplicate' } }
    )
    mocks.getGenerationStatus.mockResolvedValue({
      generationId: 'gen-1',
      status: 'completed',
      gammaUrl: 'https://gamma.app/docs/recovered',
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Another completed audit_summary already exists for this audit; this row would duplicate it',
      code: '23505',
    })
  })

  it('marks the row failed when Gamma reports failure', async () => {
    const { update } = mockReportRow({
      id: 'report-1',
      status: 'generating',
      gamma_generation_id: 'gen-1',
      gamma_url: null,
    })
    mocks.getGenerationStatus.mockResolvedValue({
      generationId: 'gen-1',
      status: 'failed',
      error: { message: 'render exploded', statusCode: 500 },
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      reportId: 'report-1',
      status: 'failed',
      error: 'render exploded',
      action: 'marked_failed',
    })
    expect(update).toHaveBeenCalledWith({
      status: 'failed',
      error_message: 'render exploded',
    })
  })

  it('returns 202 while Gamma is still rendering', async () => {
    mockReportRow({
      id: 'report-1',
      status: 'generating',
      gamma_generation_id: 'gen-1',
      gamma_url: null,
    })
    mocks.getGenerationStatus.mockResolvedValue({
      generationId: 'gen-1',
      status: 'pending',
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      reportId: 'report-1',
      status: 'pending',
      action: 'still_generating',
      message: 'Gamma is still rendering; retry reconcile in a minute or two.',
    })
  })

  it('returns 502 when the Gamma status check throws', async () => {
    mockReportRow({
      id: 'report-1',
      status: 'generating',
      gamma_generation_id: 'gen-1',
      gamma_url: null,
    })
    mocks.getGenerationStatus.mockRejectedValue(new Error('Gamma timeout'))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to query Gamma for generation status',
      details: 'Gamma timeout',
    })
  })
})
