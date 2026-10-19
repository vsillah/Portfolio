import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE } from '@/lib/social-campaign-package-qa-fixture'
import { campaignPreparationAttemptKey, campaignPreparationIdempotencyKey, SOCIAL_CAMPAIGN_RETRY_EXHAUSTED_MESSAGE } from '@/lib/social-campaign-package-preparation'
import { socialCampaignLongFormBatchQaCandidates, socialCampaignPackageQaCandidates } from '@/lib/social-campaign-package-qa-fixture'
import { campaignLongFormBatchIdempotencyKey, projectCampaignLongFormBatch } from '@/lib/social-campaign-long-form-batch'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), isAuthError: vi.fn(), from: vi.fn(), startAgentRun: vi.fn(), endAgentRun: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/agent-run', () => ({ startAgentRun: mocks.startAgentRun, endAgentRun: mocks.endAgentRun }))

import { GET, POST } from './route'

const url = `http://localhost/api/admin/social-content/campaign-packages?qa_fixture=${SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE}`
const productionUrl = 'http://localhost/api/admin/social-content/campaign-packages'
function post(candidateId: string) {
  return new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: candidateId }) })
}
function productionPost(candidateId: string) {
  return new NextRequest(productionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: candidateId }) })
}
function batchPost(target = url) {
  return new NextRequest(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare_long_form_batch' }) })
}

function mockProductionReads(history: any[], claimedRun?: (startInput: any) => any, savedRun?: (startInput: any) => any) {
  const candidate = socialCampaignPackageQaCandidates()[0]
  let agentRead = 0
  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') {
      const query: any = { select: () => query, not: () => query, order: () => query, range: async () => ({ data: [{ rag_context: { campaign_preparation_candidate: candidate } }], error: null }) }
      return query
    }
    agentRead += 1
    const read = agentRead
    const query: any = {
      select: () => query,
      in: () => query,
      eq: () => query,
      order: async () => ({ data: history, error: null }),
      single: async () => {
        const input = mocks.startAgentRun.mock.calls[0]?.[0]
        const data = read === 2 ? claimedRun?.(input) : savedRun?.(input)
        return { data: data ?? null, error: data ? null : { message: 'missing test receipt' } }
      },
    }
    return query
  })
  return candidate
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
    expect(body.long_form_inventory.slice(0, 3).map((entry: any) => [entry.product_label, entry.state])).toEqual([
      ['KickLab', 'ready'],
      ['ReversR rebuild', 'blocked'],
      ['KinFlo', 'ready'],
    ])
    expect(body.long_form_inventory).toHaveLength(12)
    expect(body.long_form_inventory.every((entry: any) => entry.packet === null)).toBe(true)
    expect(body.candidates[1].candidate.deliverables.youtube.title).toBe('')
    expect(body.candidates[0].candidate.deliverables.youtube.title).toBe('')
    expect(body.candidates[0].evaluation.package).toBeNull()
    const serialized = JSON.stringify(body.candidates[0])
    expect(serialized).not.toContain('What the Product Proof Actually Shows')
    expect(serialized).not.toContain('SHOW THE WORK')
    expect(serialized).not.toContain('turns a product lesson into a practical')
    expect(new Set(Object.values(body.external_gates))).toEqual(new Set([false]))
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('prepares a bounded mixed long-form batch with canonical evaluation receipts and no provider crossing', async () => {
    const response = await POST(batchPost())
    expect(response.status).toBe(200)
    const body = await response.json()
    const batch = body.run.metadata.long_form_batch
    expect(batch).toMatchObject({ total: 12, scanned: 12, chunk_size: 10, chunks_processed: 2, prepared_count: 11, blocked_count: 1, deferred_count: 0, remaining: 0 })
    expect(batch.prepared.map((packet: any) => packet.campaign_identity)).toEqual(projectCampaignLongFormBatch(socialCampaignLongFormBatchQaCandidates(), new Date('2026-10-19T12:00:00.000Z')).prepared.map((packet) => packet.campaign_identity))
    expect(batch.blocked).toEqual([expect.objectContaining({ campaign_identity: 'reversr', packet: null })])
    expect(batch.prepared.every((packet: any) => packet.evaluation_receipt.approval_ready)).toBe(true)
    expect(batch.prepared.every((packet: any) => packet.evaluation_receipt.topic_evidence.status === 'passed')).toBe(true)
    expect(batch.prepared.every((packet: any) => packet.evaluation_receipt.originality.status === 'passed')).toBe(true)
    expect(batch.prepared.every((packet: any) => packet.customer_facing_copy_receipt.status === 'passed')).toBe(true)
    expect(new Set(Object.values(batch.external_gates))).toEqual(new Set([false]))
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('replays an existing production long-form batch receipt without a duplicate or external action', async () => {
    const candidate = socialCampaignPackageQaCandidates()[0]
    const batch = projectCampaignLongFormBatch([candidate], new Date('2026-10-19T12:00:00.000Z'))
    const baseKey = campaignLongFormBatchIdempotencyKey(batch)
    const existing = { id: 'long-form-batch-run', status: 'completed', idempotency_key: campaignPreparationAttemptKey(baseKey, 1), metadata: { attempt_number: 1, long_form_batch: batch } }
    mockProductionReads([existing])
    const response = await POST(batchPost(productionUrl))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ duplicate: true, run: { id: 'long-form-batch-run', status: 'completed' } })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
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

  it('creates only attempt two after a failed first receipt and exposes the bounded retry counters', async () => {
    const candidate = socialCampaignPackageQaCandidates()[0]
    const baseKey = campaignPreparationIdempotencyKey(candidate)
    const failed = { id: 'run-attempt-1', status: 'failed', idempotency_key: campaignPreparationAttemptKey(baseKey, 1), metadata: { attempt_number: 1 } }
    mockProductionReads([failed], (input) => ({ id: 'run-attempt-2', status: 'running', idempotency_key: input.idempotencyKey, metadata: input.metadata }), (input) => ({ id: 'run-attempt-2', status: 'completed', idempotency_key: input.idempotencyKey, metadata: input.metadata }))
    mocks.startAgentRun.mockResolvedValue({ id: 'run-attempt-2' })
    mocks.endAgentRun.mockResolvedValue(undefined)

    const response = await POST(productionPost(candidate.candidate_id))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ duplicate: false, retry_count: 1, retry_limit: 1 })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: campaignPreparationAttemptKey(baseKey, 2),
      metadata: expect.objectContaining({ base_idempotency_key: baseKey, attempt_number: 2, retry_count: 1, retry_limit: 1, maximum_attempts: 2 }),
    }))
    expect(mocks.endAgentRun).toHaveBeenCalledTimes(1)
  })

  it('fails closed with exact recovery after two terminal attempts', async () => {
    const candidate = socialCampaignPackageQaCandidates()[0]
    const baseKey = campaignPreparationIdempotencyKey(candidate)
    mockProductionReads([
      { id: 'run-attempt-1', status: 'failed', idempotency_key: campaignPreparationAttemptKey(baseKey, 1), metadata: { attempt_number: 1 } },
      { id: 'run-attempt-2', status: 'stale', idempotency_key: campaignPreparationAttemptKey(baseKey, 2), metadata: { attempt_number: 2 } },
    ])
    const response = await POST(productionPost(candidate.candidate_id))
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: SOCIAL_CAMPAIGN_RETRY_EXHAUSTED_MESSAGE, code: 'campaign_preparation_retry_exhausted', retry_count: 1, retry_limit: 1, recovery_label: 'Refresh source evidence' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('replays the concurrently claimed retry without completing or duplicating it', async () => {
    const candidate = socialCampaignPackageQaCandidates()[0]
    const baseKey = campaignPreparationIdempotencyKey(candidate)
    const failed = { id: 'run-attempt-1', status: 'failed', idempotency_key: campaignPreparationAttemptKey(baseKey, 1), metadata: { attempt_number: 1 } }
    mockProductionReads([failed], (input) => ({ id: 'run-attempt-2', status: 'running', idempotency_key: input.idempotencyKey, metadata: { ...input.metadata, preparation_claim: 'another-request-owns-this-attempt' } }))
    mocks.startAgentRun.mockResolvedValue({ id: 'run-attempt-2' })

    const response = await POST(productionPost(candidate.candidate_id))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ duplicate: true, retry_count: 1, retry_limit: 1, run: { id: 'run-attempt-2', status: 'running' } })
    expect(mocks.startAgentRun).toHaveBeenCalledTimes(1)
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })
})

