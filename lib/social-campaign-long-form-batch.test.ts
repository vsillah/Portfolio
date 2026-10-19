import { describe, expect, it } from 'vitest'
import { socialCampaignLongFormBatchQaCandidates, socialCampaignPackageQaCandidates } from '@/lib/social-campaign-package-qa-fixture'
import {
  campaignLongFormBatchIdempotencyKey,
  inspectCustomerFacingScript,
  projectCampaignLongFormBatch,
  projectCampaignLongFormDraft,
} from '@/lib/social-campaign-long-form-batch'

const NOW = new Date('2026-10-19T12:00:00.000Z')

describe('campaign long-form script batch', () => {
  it('prepares only eligible items in a mixed backlog and keeps blocked items visible without draft text', () => {
    const batch = projectCampaignLongFormBatch(socialCampaignPackageQaCandidates(), NOW)
    expect(batch.scanned).toBe(3)
    expect(batch.prepared.map((packet) => packet.campaign_identity)).toEqual(['kicklab'])
    expect(batch.blocked).toEqual(expect.arrayContaining([
      expect.objectContaining({ campaign_identity: 'reversr', ready: false, packet: null }),
      expect.objectContaining({ campaign_identity: 'kinflo', ready: false, packet: null }),
    ]))
    expect(batch.blocked.find((entry) => entry.campaign_identity === 'reversr')?.blockers).toContainEqual(expect.objectContaining({ code: 'evidence_stale', recovery_label: 'Refresh evidence' }))
    expect(JSON.stringify(batch.blocked)).not.toContain('script_text')
    expect(batch.prepared.every((packet) => packet.evaluation_receipt.approval_ready)).toBe(true)
    expect(batch.prepared.every((packet) => packet.evaluation_receipt.dimensions.map((dimension) => dimension.key).includes('first_30_seconds'))).toBe(true)
    expect(new Set(Object.values(batch.external_gates))).toEqual(new Set([false]))
  })

  it('returns the same packet and batch identities for a duplicate replay', () => {
    const first = projectCampaignLongFormBatch(socialCampaignLongFormBatchQaCandidates(), NOW)
    const replay = projectCampaignLongFormBatch(structuredClone(socialCampaignLongFormBatchQaCandidates()).reverse(), NOW)
    expect(replay.batch_id).toBe(first.batch_id)
    expect(replay.input_fingerprint).toBe(first.input_fingerprint)
    expect(replay.prepared.map((packet) => packet.packet_id)).toEqual(first.prepared.map((packet) => packet.packet_id))
    expect(campaignLongFormBatchIdempotencyKey(replay)).toBe(campaignLongFormBatchIdempotencyKey(first))
  })

  it('processes every item beyond the first chunk and reports complete backlog coverage', () => {
    const batch = projectCampaignLongFormBatch(socialCampaignLongFormBatchQaCandidates(), NOW)
    expect(batch).toMatchObject({ total: 12, scanned: 12, chunk_size: 10, chunks_processed: 2, prepared_count: 1, blocked_count: 11, deferred_count: 0, remaining: 0 })
    expect(batch.chunks.map((chunk) => chunk.scanned)).toEqual([10, 2])
    expect(new Set([...batch.prepared.map((packet) => packet.candidate_id), ...batch.blocked.map((entry) => entry.candidate_id)]).size).toBe(12)
    expect(batch.chunks.flatMap((chunk) => chunk.candidate_ids)).toHaveLength(12)
  })

  it('blocks internal workflow vocabulary from customer-facing spoken beats', () => {
    const receipt = inspectCustomerFacingScript([{
      id: 'bad-cta', start_seconds: 0, end_seconds: 10, role: 'cta',
      text: 'Send this review-only script to the Decision Queue before any provider gate opens.',
      broll_cue: null, pattern_interrupt: null,
    }])
    expect(receipt.status).toBe('blocked')
    expect(receipt.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(['review_workflow', 'production_gate']))
  })

  it('blocks a stale framework receipt with an exact recovery action and no draft', () => {
    const candidate = structuredClone(socialCampaignPackageQaCandidates()[0])
    candidate.long_form_script_input!.fresh_until = '2026-10-18T13:00:00.000Z'
    const projection = projectCampaignLongFormDraft(candidate, NOW)
    expect(projection).toMatchObject({ ready: false, state: 'blocked', packet: null })
    expect(projection.blockers).toContainEqual(expect.objectContaining({
      code: 'long_form_framework_stale',
      recovery_label: 'Refresh long-form evidence',
      recovery_href: '/admin/content/video-generation?campaign=kicklab&review=script-intelligence',
    }))
  })

  it('covers every canonical evaluation dimension plus live topic evidence and creator distance', () => {
    const projection = projectCampaignLongFormDraft(socialCampaignPackageQaCandidates()[0], NOW)
    expect(projection.ready).toBe(true)
    const receipt = projection.packet!.evaluation_receipt
    expect(receipt.dimensions.map((dimension) => dimension.key)).toEqual([
      'first_30_seconds',
      'hook_promise_alignment',
      'open_loops',
      'rehooks',
      'proof_placement',
      'pacing',
      'pattern_interrupts',
      'broll_cues',
      'payoff',
      'spoken_conclusion',
      'delivered_cta',
      'chapter_development',
      'campaign_specificity',
      'framework_mapping',
    ])
    expect(receipt.topic_evidence.status).toBe('passed')
    expect(receipt.originality.status).toBe('passed')
    expect(projection.packet!.title_thumbnail_distinct).toBe(true)
    expect(projection.packet!.product_evidence_bindings).toEqual([expect.objectContaining({
      product_proof_receipt_id: projection.packet!.product_proof_receipt_id,
      claim_beat_ids: ['campaign-proof'],
      privacy_receipt_id: projection.packet!.privacy_receipt_id,
    })])
    expect(projection.packet!.customer_facing_copy_receipt).toMatchObject({ status: 'passed', findings: [] })
    expect(inspectCustomerFacingScript(projection.packet!.beats).status).toBe('passed')
  })
})
