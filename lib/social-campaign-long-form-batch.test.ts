import { describe, expect, it } from 'vitest'
import { socialCampaignPackageQaCandidates } from '@/lib/social-campaign-package-qa-fixture'
import {
  campaignLongFormBatchIdempotencyKey,
  projectCampaignLongFormBatch,
  projectCampaignLongFormDraft,
} from '@/lib/social-campaign-long-form-batch'

const NOW = new Date('2026-10-19T12:00:00.000Z')

describe('campaign long-form script batch', () => {
  it('prepares only eligible items in a mixed backlog and keeps blocked items visible without draft text', () => {
    const batch = projectCampaignLongFormBatch(socialCampaignPackageQaCandidates(), NOW)
    expect(batch.scanned).toBe(3)
    expect(batch.prepared.map((packet) => packet.campaign_identity)).toEqual(['kicklab', 'kinflo'])
    expect(batch.blocked).toEqual([expect.objectContaining({ campaign_identity: 'reversr', ready: false, packet: null })])
    expect(batch.blocked[0].blockers).toContainEqual(expect.objectContaining({ code: 'evidence_stale', recovery_label: 'Refresh evidence' }))
    expect(JSON.stringify(batch.blocked)).not.toContain('script_text')
    expect(batch.prepared.every((packet) => packet.evaluation_receipt.approval_ready)).toBe(true)
    expect(batch.prepared.every((packet) => packet.evaluation_receipt.dimensions.map((dimension) => dimension.key).includes('first_30_seconds'))).toBe(true)
    expect(new Set(Object.values(batch.external_gates))).toEqual(new Set([false]))
  })

  it('returns the same packet and batch identities for a duplicate replay', () => {
    const first = projectCampaignLongFormBatch(socialCampaignPackageQaCandidates(), NOW)
    const replay = projectCampaignLongFormBatch(structuredClone(socialCampaignPackageQaCandidates()), NOW)
    expect(replay.batch_id).toBe(first.batch_id)
    expect(replay.input_fingerprint).toBe(first.input_fingerprint)
    expect(replay.prepared.map((packet) => packet.packet_id)).toEqual(first.prepared.map((packet) => packet.packet_id))
    expect(campaignLongFormBatchIdempotencyKey(replay)).toBe(campaignLongFormBatchIdempotencyKey(first))
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
    ])
    expect(receipt.topic_evidence.status).toBe('passed')
    expect(receipt.originality.status).toBe('passed')
    expect(projection.packet!.title_thumbnail_distinct).toBe(true)
    expect(projection.packet!.product_evidence_bindings).toEqual([expect.objectContaining({
      product_proof_receipt_id: projection.packet!.product_proof_receipt_id,
      claim_beat_ids: ['campaign-proof'],
      privacy_receipt_id: projection.packet!.privacy_receipt_id,
    })])
  })
})
