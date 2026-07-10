import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  auditVisualAssets: vi.fn(),
  captureVisualAssetCandidates: vi.fn(),
  listVisualAssetCandidates: vi.fn(),
  reviewVisualAssetCandidate: vi.fn(),
  regenerateRejectedVisualAssetCandidate: vi.fn(),
  applyApprovedVisualAssetCandidates: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: any) => Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/visual-assets', () => ({
  VISUAL_ASSET_ENTITY_TYPES: ['product', 'service', 'prototype'],
  VISUAL_ASSET_STATUSES: ['proposed', 'approved', 'rejected', 'applied', 'failed'],
  VISUAL_ASSET_THEMES: ['dark', 'light'],
  VISUAL_ASSET_CANDIDATE_STATES: ['captured', 'needs_capture'],
  isVisualAssetEntityType: (value: string) => ['product', 'service', 'prototype'].includes(value),
  isVisualAssetStatus: (value: string) => ['proposed', 'approved', 'rejected', 'applied', 'failed'].includes(value),
  isVisualAssetTheme: (value: string) => ['dark', 'light'].includes(value),
  isVisualAssetCandidateState: (value: string) => ['captured', 'needs_capture'].includes(value),
  auditVisualAssets: mocks.auditVisualAssets,
  captureVisualAssetCandidates: mocks.captureVisualAssetCandidates,
  listVisualAssetCandidates: mocks.listVisualAssetCandidates,
  reviewVisualAssetCandidate: mocks.reviewVisualAssetCandidate,
  regenerateRejectedVisualAssetCandidate: mocks.regenerateRejectedVisualAssetCandidate,
  applyApprovedVisualAssetCandidates: mocks.applyApprovedVisualAssetCandidates,
}))

type NextRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>

function request(path: string, init: NextRequestInit = {}) {
  return new NextRequest(new URL(path, 'http://localhost:3000'), init)
}

function expectResponse(response: Response | undefined): asserts response is Response {
  expect(response).toBeDefined()
}

describe('visual asset admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('lists candidates with status, entity, theme, and candidate-state filters', async () => {
    const { GET } = await import('./candidates/route')
    mocks.listVisualAssetCandidates.mockResolvedValue([{ id: 'candidate-1' }])

    const response = await GET(request('/api/admin/visual-assets/candidates?status=proposed&entity_type=product&theme=dark&candidate_state=captured'))
    expectResponse(response)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.candidates).toEqual([{ id: 'candidate-1' }])
    expect(mocks.listVisualAssetCandidates).toHaveBeenCalledWith(expect.objectContaining({
      status: 'proposed',
      entityType: 'product',
      theme: 'dark',
      candidateState: 'captured',
    }))
  })

  it('treats explicit all candidate filters as unrestricted', async () => {
    const { GET } = await import('./candidates/route')
    mocks.listVisualAssetCandidates.mockResolvedValue([{ id: 'candidate-1' }])
    const url = '/api/admin/visual-assets/candidates?status=all&entity_type=all&theme=all&candidate_state=all&limit=5000'

    const response = await GET(request(url))
    expectResponse(response)

    expect(response.status).toBe(200)
    expect(mocks.listVisualAssetCandidates).toHaveBeenCalledWith({
      status: undefined,
      entityType: undefined,
      theme: undefined,
      candidateState: undefined,
      limit: 250,
    })
  })

  it('audit creates candidates without applying approved assets', async () => {
    const { POST } = await import('./audit/route')
    mocks.auditVisualAssets.mockResolvedValue({ entitiesScanned: 4, candidatesCreated: 2, candidates: [] })

    const response = await POST(request('/api/admin/visual-assets/audit', {
      method: 'POST',
      body: JSON.stringify({ createWorkItem: true }),
    }))
    expectResponse(response)

    expect(response.status).toBe(200)
    expect(mocks.auditVisualAssets).toHaveBeenCalledWith(expect.objectContaining({ createWorkItem: true }))
    expect(mocks.applyApprovedVisualAssetCandidates).not.toHaveBeenCalled()
  })

  it('capture uploads candidates without applying them', async () => {
    const { POST } = await import('./capture/route')
    mocks.captureVisualAssetCandidates.mockResolvedValue({ captured: 1, candidates: [{ id: 'candidate-1' }] })

    const response = await POST(request('/api/admin/visual-assets/capture', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-1'] }),
    }))
    expectResponse(response)

    expect(response.status).toBe(200)
    expect(mocks.captureVisualAssetCandidates).toHaveBeenCalledWith(expect.objectContaining({
      candidateIds: ['candidate-1'],
    }))
    expect(mocks.applyApprovedVisualAssetCandidates).not.toHaveBeenCalled()
  })

  it('approve requires admin auth', async () => {
    const { POST } = await import('./[id]/approve/route')
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(request('/api/admin/visual-assets/candidate-1/approve', {
      method: 'POST',
    }), { params: { id: 'candidate-1' } })
    expectResponse(response)

    expect(response.status).toBe(401)
    expect(mocks.reviewVisualAssetCandidate).not.toHaveBeenCalled()
  })

  it('approves a candidate with the authenticated reviewer and review reason', async () => {
    const { POST } = await import('./[id]/approve/route')
    mocks.reviewVisualAssetCandidate.mockResolvedValue({
      id: 'candidate-1',
      status: 'approved',
      reviewed_by: 'admin-1',
      metadata: { review_reason: 'Strong feature signal' },
    })

    const response = await POST(request('/api/admin/visual-assets/candidate-1/approve', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Strong feature signal' }),
    }), { params: { id: 'candidate-1' } })
    expectResponse(response)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.candidate).toMatchObject({ id: 'candidate-1', status: 'approved' })
    expect(mocks.reviewVisualAssetCandidate).toHaveBeenCalledWith({
      id: 'candidate-1',
      status: 'approved',
      reviewedBy: 'admin-1',
      reason: 'Strong feature signal',
    })
  })

  it('requires a rejection reason before rejecting a candidate', async () => {
    const { POST } = await import('./[id]/reject/route')

    const response = await POST(request('/api/admin/visual-assets/candidate-2/reject', {
      method: 'POST',
      body: JSON.stringify({ reason: { text: 'nope' } }),
    }), { params: { id: 'candidate-2' } })
    expectResponse(response)

    expect(response.status).toBe(400)
    expect(mocks.reviewVisualAssetCandidate).not.toHaveBeenCalled()
  })

  it('rejects a candidate with feedback for regeneration', async () => {
    const { POST } = await import('./[id]/reject/route')
    mocks.reviewVisualAssetCandidate.mockResolvedValue({
      id: 'candidate-2',
      status: 'rejected',
      reviewed_by: 'admin-1',
      metadata: { review_reason: 'Too blank' },
    })

    const response = await POST(request('/api/admin/visual-assets/candidate-2/reject', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Too much blank space.',
        recommendation: 'Tighten the crop and show the dashboard.',
        reasonCodes: ['high_blank_space_ratio', 'weak_feature_signal'],
      }),
    }), { params: { id: 'candidate-2' } })
    expectResponse(response)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.candidate).toMatchObject({ id: 'candidate-2', status: 'rejected' })
    expect(mocks.reviewVisualAssetCandidate).toHaveBeenCalledWith({
      id: 'candidate-2',
      status: 'rejected',
      reviewedBy: 'admin-1',
      reason: 'Too much blank space.',
      recommendation: 'Tighten the crop and show the dashboard.',
      reasonCodes: ['high_blank_space_ratio', 'weak_feature_signal'],
    })
  })

  it('regenerates a rejected candidate and captures only its replacement', async () => {
    const { POST } = await import('./[id]/regenerate/route')
    mocks.regenerateRejectedVisualAssetCandidate.mockResolvedValue({
      id: 'replacement-1',
      status: 'proposed',
    })
    mocks.captureVisualAssetCandidates.mockResolvedValue({ captured: 1, passed: 1, blocked: 0, candidates: [{ id: 'replacement-1' }] })

    const response = await POST(request('/api/admin/visual-assets/candidate-2/regenerate', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Too dark.',
        recommendation: 'Use a light-mode frame.',
        reasonCodes: ['dark_mode_mismatch'],
      }),
    }), { params: { id: 'candidate-2' } })
    expectResponse(response)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.replacementCandidate).toMatchObject({ id: 'replacement-1' })
    expect(mocks.regenerateRejectedVisualAssetCandidate).toHaveBeenCalledWith({
      sourceCandidateId: 'candidate-2',
      requestedBy: 'admin-1',
      feedback: {
        reason: 'Too dark.',
        recommendation: 'Use a light-mode frame.',
        reasonCodes: ['dark_mode_mismatch'],
      },
    })
    expect(mocks.captureVisualAssetCandidates).toHaveBeenCalledWith(expect.objectContaining({
      candidateIds: ['replacement-1'],
    }))
  })

  it('apply-approved only calls the approved candidate apply helper', async () => {
    const { POST } = await import('./apply-approved/route')
    mocks.applyApprovedVisualAssetCandidates.mockResolvedValue({ applied: 1, failed: 0, failures: [] })

    const response = await POST(request('/api/admin/visual-assets/apply-approved', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-1'] }),
    }))
    expectResponse(response)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ applied: 1, failed: 0 })
    expect(mocks.applyApprovedVisualAssetCandidates).toHaveBeenCalledWith({
      candidateIds: ['candidate-1'],
    })
  })
})
