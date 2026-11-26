import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), review: vi.fn(), receipt: vi.fn(), decide: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (value: { error?: string }) => !!value.error }))
vi.mock('@/lib/evidence-repair-human-qa', () => ({
  RepairDecisionError: class extends Error { constructor(message: string, public status = 409) { super(message) } },
  getEvidenceRepairReview: mocks.review, getEvidenceRepairDecisionReceipt: mocks.receipt,
  decideEvidenceRepairHumanQa: mocks.decide,
  evidenceRepairReviewPath: (id: string) => `/admin/agents/content-intelligence?section=research&packet=${id}`,
}))
vi.mock('@/lib/evidence-repair-slack', () => ({ evidenceRepairSlackEnabled: () => false }))
import { GET, POST } from './route'

const packetId = '10000000-0000-4000-8000-000000000001'
const reviewerId = '10000000-0000-4000-8000-000000000005'
const context = { params: Promise.resolve({ id: packetId }) }
const request = (body: unknown) => POST(new NextRequest('http://localhost/api/repair-decision', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
}), context)

describe('authenticated evidence repair decision API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: reviewerId } })
    mocks.review.mockResolvedValue({ binding: { packetId }, title: 'Synthetic packet', sourceUrl: 'https://example.test',
      sourceUseBoundary: 'Bounded source use', supportedClaims: ['Claim one'], removedClaims: [], status: 'human_qa_pending' })
    mocks.receipt.mockResolvedValue(null)
    mocks.decide.mockResolvedValue({ id: 'receipt-1', decision: 'approve', external_execution_enabled: false })
  })

  it('denies unauthorized review and decision before any service call', async () => {
    mocks.auth.mockResolvedValue({ error: 'Denied', status: 403 })
    expect((await GET(new NextRequest('http://localhost/api/repair-decision'), context)).status).toBe(403)
    expect((await request({ decision: 'approve' })).status).toBe(403)
    expect(mocks.review).not.toHaveBeenCalled()
    expect(mocks.decide).not.toHaveBeenCalled()
  })

  it('uses the same canonical decision service with the authenticated Portfolio reviewer', async () => {
    const result = await request({ decision: 'approve', reason: 'Exact source verified',
      packet_version: '2026-11-25T12:00:00Z', binding_hash: 'a'.repeat(64) })
    expect(result.status).toBe(200)
    expect(mocks.decide).toHaveBeenCalledWith({ packetId,
      packetVersion: '2026-11-25T12:00:00Z', bindingHash: 'a'.repeat(64), decision: 'approve',
      reason: 'Exact source verified', reviewerId, surface: 'portfolio' })
    expect(await result.json()).toMatchObject({ receipt: { id: 'receipt-1' }, external_execution_enabled: false })
  })

  it('returns the persisted terminal receipt for Portfolio reconciliation', async () => {
    mocks.review.mockRejectedValue(new Error('Already decided'))
    mocks.receipt.mockResolvedValue({ id: 'receipt-1', decision: 'reject', reason: 'Unsupported claim',
      external_execution_enabled: false })
    const response = await GET(new NextRequest('http://localhost/api/repair-decision'), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ terminal_receipt: { id: 'receipt-1', decision: 'reject' } })
  })

  it('rejects an incomplete action before persistence', async () => {
    expect((await request({ decision: 'approve', reason: 'missing binding' })).status).toBe(400)
    expect(mocks.decide).not.toHaveBeenCalled()
  })
})
