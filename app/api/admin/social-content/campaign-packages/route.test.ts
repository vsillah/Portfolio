import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SOCIAL_CAMPAIGN_APPROVED_ADAPTATION_QA_FIXTURE, SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE } from '@/lib/social-campaign-package-qa-fixture'
import { campaignPreparationAttemptKey, campaignPreparationIdempotencyKey, SOCIAL_CAMPAIGN_RETRY_EXHAUSTED_MESSAGE } from '@/lib/social-campaign-package-preparation'
import { socialCampaignLongFormBatchQaCandidates, socialCampaignPackageQaCandidates } from '@/lib/social-campaign-package-qa-fixture'
import { campaignLongFormBatchIdempotencyKey, projectCampaignLongFormBatch } from '@/lib/social-campaign-long-form-batch'
import { campaignVisualBatchIdempotencyKey, projectCampaignVisualBatch } from '@/lib/social-campaign-visual-plan'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), isAuthError: vi.fn(), from: vi.fn(), startAgentRun: vi.fn(), endAgentRun: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/agent-run', () => ({ startAgentRun: mocks.startAgentRun, endAgentRun: mocks.endAgentRun }))

import { GET, POST } from './route'

const url = `http://localhost/api/admin/social-content/campaign-packages?qa_fixture=${SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE}`
const productionUrl = 'http://localhost/api/admin/social-content/campaign-packages'
const approvedReviewUrl = `${productionUrl}?qa_fixture=${SOCIAL_CAMPAIGN_APPROVED_ADAPTATION_QA_FIXTURE}`
function post(candidateId: string) {
  return new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: candidateId }) })
}
function productionPost(candidateId: string) {
  return new NextRequest(productionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: candidateId }) })
}
function batchPost(target = url, action = 'prepare_long_form_batch') {
  return new NextRequest(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
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

  it('projects approved source storyboards and exact blockers locally without production reads or writes', async () => {
    const response = await GET(new NextRequest(approvedReviewUrl))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.approved_adaptation_review.adaptations.map((item: any) => [item.social_content_id, item.current_content_version, item.source_input_version, item.status])).toEqual([
      ['939b01e3-d1af-42c8-805e-0379f09efd60', 'sha256:392b3e2a92c5ab65e4cc93706571df761bac7ea38631bf06002fd6b89f3302a2', 'sha256:e6fc9ae4aadd61e3a871e8f7af2dd0a2d424d5c20ae6a8d0eac861b16e796bd5', 'human_qa_rereview_required'],
      ['21c492c2-9279-4e08-afc9-49207935a681', 'sha256:4d3bc63ebaeb1aed344d64ed15ebb0ff865772de48b48249526ccce0b2c02e9e', 'sha256:4d3bc63ebaeb1aed344d64ed15ebb0ff865772de48b48249526ccce0b2c02e9e', 'source_ready_capture_pending'],
    ])
    expect(body.approved_adaptation_review.adaptations.every((item: any) => item.source_readiness.ready && item.scenes.length >= 9 && item.evidence_assets.length > 0)).toBe(true)
    expect(body.approved_adaptation_review.adaptations.map((item: any) => [item.storyboard_review.campaign_identity, item.storyboard_review.assets.length, item.storyboard_review.scenes.length])).toEqual([
      ['jev', 2, 9],
      ['dark-castle-chess', 1, 9],
    ])
    expect(body.approved_adaptation_review.adaptations.every((item: any) => item.storyboard_review.status === 'review_direction_blocked')).toBe(true)
    expect(body.approved_adaptation_review.adaptations.every((item: any) => new Set(Object.values(item.storyboard_review.external_gates)).size === 1 && Object.values(item.storyboard_review.external_gates)[0] === false)).toBe(true)
    expect(body.approved_adaptation_review.adaptations[0].storyboard_review.evidence_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'freshness', status: 'stale' }),
      expect.objectContaining({ key: 'hero', status: 'passed' }),
      expect.objectContaining({ key: 'thumbnail', status: 'blocked' }),
    ]))
    expect(body.approved_adaptation_review.adaptations[1].storyboard_review.evidence_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'freshness', status: 'passed' }),
      expect.objectContaining({ key: 'hero', status: 'blocked' }),
      expect.objectContaining({ key: 'description', status: 'blocked' }),
    ]))
    expect(body.approved_adaptation_review.blocked_items).toHaveLength(3)
    expect(body.approved_adaptation_review.human_qa).toEqual({ status: 'pending_human_qa', screenshots: [], mp4: null })
    expect(new Set(Object.values(body.approved_adaptation_review.external_gates))).toEqual(new Set([false]))
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects all POST actions on the approved adaptation projection', async () => {
    const response = await POST(batchPost(approvedReviewUrl, 'prepare_visual_batch'))
    expect(response.status).toBe(405)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
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
      ['KinFlo', 'blocked'],
    ])
    expect(body.long_form_inventory).toHaveLength(12)
    expect(body.long_form_inventory.every((entry: any) => entry.packet === null)).toBe(true)
    expect(body.candidates[1].candidate.deliverables.youtube.title).toBe('')
    expect(body.candidates[0].candidate.deliverables.youtube.title).toBe('')
    expect(body.candidates[0].evaluation.package).toBeNull()
    expect(body.visual_inventory).toHaveLength(12)
    expect(body.visual_inventory.slice(0, 3).map((entry: any) => [entry.product_label, entry.state])).toEqual([
      ['KickLab', 'unscored'],
      ['ReversR rebuild', 'blocked'],
      ['KinFlo', 'blocked'],
    ])
    expect(body.visual_inventory.every((entry: any) => entry.plan === null)).toBe(true)
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
    expect(batch).toMatchObject({ total: 12, scanned: 12, chunk_size: 10, chunks_processed: 2, prepared_count: 1, blocked_count: 11, deferred_count: 0, remaining: 0 })
    expect(batch.prepared.map((packet: any) => packet.campaign_identity)).toEqual(projectCampaignLongFormBatch(socialCampaignLongFormBatchQaCandidates(), new Date('2026-10-19T12:00:00.000Z')).prepared.map((packet) => packet.campaign_identity))
    expect(batch.blocked).toEqual(expect.arrayContaining([
      expect.objectContaining({ campaign_identity: 'reversr', packet: null }),
      expect.objectContaining({ campaign_identity: 'kinflo', packet: null }),
    ]))
    expect(batch.prepared.every((packet: any) => packet.evaluation_receipt.approval_ready)).toBe(true)
    expect(batch.prepared.every((packet: any) => packet.evaluation_receipt.topic_evidence.status === 'passed')).toBe(true)
    expect(batch.prepared.every((packet: any) => packet.evaluation_receipt.originality.status === 'passed')).toBe(true)
    expect(batch.prepared.every((packet: any) => packet.customer_facing_copy_receipt.status === 'passed')).toBe(true)
    expect(new Set(Object.values(batch.external_gates))).toEqual(new Set([false]))
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('keeps the full visual backlog reviewable but blocks readiness while typography performance is unscored', async () => {
    const response = await POST(batchPost(url, 'prepare_visual_batch'))
    expect(response.status).toBe(200)
    const body = await response.json()
    const batch = body.run.metadata.visual_batch
    expect(batch).toMatchObject({ total: 12, scanned: 12, prepared_count: 0, blocked_count: 12, remaining: 0, chunks_processed: 2 })
    expect(batch.blocked[0]).toMatchObject({ campaign_identity: 'kicklab', ready: false, evaluation: { status: 'unscored', approval_ready: false } })
    expect(batch.blocked[0].plan.beats.map((beat: any) => beat.channel)).toEqual(expect.arrayContaining(['linkedin', 'youtube_thumbnail', 'youtube_long_form', 'short_form']))
    expect(batch.blocked[0].evaluation.dimensions).toHaveLength(13)
    expect(batch.blocked[0].evaluation.dimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'scene_cinematography', status: 'passed' }),
      expect.objectContaining({ key: 'typography_compositing', status: 'passed' }),
      expect.objectContaining({ key: 'typography_style_evidence', status: 'unscored', score: null }),
    ]))
    expect(batch.blocked).toEqual(expect.arrayContaining([expect.objectContaining({ campaign_identity: 'reversr', ready: false })]))
    expect(new Set(Object.values(batch.external_gates))).toEqual(new Set([false]))
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('replays an existing production visual batch receipt without duplicating it', async () => {
    const batch = projectCampaignVisualBatch([socialCampaignPackageQaCandidates()[0]], new Date('2026-10-19T12:00:00.000Z'))
    const baseKey = campaignVisualBatchIdempotencyKey(batch)
    const existing = { id: 'visual-batch-run', status: 'completed', idempotency_key: campaignPreparationAttemptKey(baseKey, 1), metadata: { attempt_number: 1, visual_batch: batch } }
    mockProductionReads([existing])
    const response = await POST(batchPost(productionUrl, 'prepare_visual_batch'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ duplicate: true, run: { id: 'visual-batch-run', status: 'completed' } })
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

