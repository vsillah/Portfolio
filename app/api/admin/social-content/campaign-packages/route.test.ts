import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE } from '@/lib/social-campaign-package-qa-fixture'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), isAuthError: vi.fn(), from: vi.fn(), startAgentRun: vi.fn(), endAgentRun: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/agent-run', () => ({ startAgentRun: mocks.startAgentRun, endAgentRun: mocks.endAgentRun }))

import { GET, POST } from './route'

const url = `http://localhost/api/admin/social-content/campaign-packages?qa_fixture=${SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE}`
function post(candidateId: string) {
  return new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: candidateId }) })
}

describe('campaign review package route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'staff-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires authorized Portfolio staff before reading candidates or receipts', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('projects ready, blocked, and closed-side-effect states without production reads', async () => {
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.candidates).toHaveLength(3)
    expect(body.candidates.map((entry: any) => [entry.candidate.product_label, entry.evaluation.state])).toEqual([
      ['KickLab', 'ready'],
      ['ReversR rebuild', 'blocked'],
      ['KinFlo', 'ready'],
    ])
    expect(body.candidates[1].candidate.deliverables.youtube.title).toBe('')
    expect(body.candidates[0].candidate.deliverables.youtube.title).toBe('')
    expect(new Set(Object.values(body.external_gates))).toEqual(new Set([false]))
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('fails closed on a stale ReversR candidate and returns its recovery action', async () => {
    const response = await POST(post('candidate:reversr:campaign:v1'))
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.evaluation.package).toBeNull()
    expect(body.evaluation.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'evidence_stale', recovery_label: 'Refresh evidence' })]))
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('returns the same receipt identity for repeat preparation and never exposes an external action', async () => {
    const first = await POST(post('candidate:kicklab:campaign:v1'))
    const second = await POST(post('candidate:kicklab:campaign:v1'))
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const firstBody = await first.json()
    const secondBody = await second.json()
    expect(firstBody.run.id).toBe(secondBody.run.id)
    expect(firstBody.run.idempotency_key).toBe(secondBody.run.idempotency_key)
    expect(new Set(Object.values(firstBody.run.outcome.external_gates))).toEqual(new Set([false]))
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })
})

