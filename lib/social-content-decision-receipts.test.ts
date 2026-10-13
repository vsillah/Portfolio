import { describe, expect, it } from 'vitest'
import {
  getSocialContentDecisionReadiness,
  socialContentDecisionIdempotencyKey,
} from '@/lib/social-content-decision-receipts'

const VERSION = '2026-10-12T18:30:00.000Z'

function receipt(status = 'approved', version = VERSION) {
  return {
    receipt_id: crypto.randomUUID(),
    status,
    content_updated_at: version,
  }
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    updated_at: VERSION,
    rag_context: {
      mobile_decision_review: {
        version: 'social-content-decision-review/v1',
        approval_id: '22222222-2222-4222-8222-222222222222',
        run_id: '33333333-3333-4333-8333-333333333333',
        work_item_id: '44444444-4444-4444-8444-444444444444',
        content_id: '11111111-1111-4111-8111-111111111111',
        content_updated_at: VERSION,
        current_gate: 'copy_review',
        next_gate: 'visual_review',
        receipts: {
          source: receipt(),
          voice: receipt(),
          framework: receipt(),
          privacy: receipt(),
          visual: receipt(),
          challenger: receipt(),
        },
        candidate_projection: { headline: 'Read-only candidate' },
        ...overrides,
      },
    },
  }
}

describe('Social Content mobile decision readiness', () => {
  it('accepts a version-bound packet only when every required receipt passed', () => {
    const readiness = getSocialContentDecisionReadiness(item() as never)

    expect(readiness.ready).toBe(true)
    expect(readiness.blockers).toEqual([])
    expect(readiness.recorded_decision).toBeNull()
    expect(readiness.packet?.next_gate).toBe('visual_review')
    expect(readiness.packet?.candidate_projection).toEqual({ headline: 'Read-only candidate' })
  })

  it('fails closed when the central Decision Queue packet is missing', () => {
    const candidate = item()
    delete (candidate.rag_context as Record<string, unknown>).mobile_decision_review

    const readiness = getSocialContentDecisionReadiness(candidate as never)

    expect(readiness.ready).toBe(false)
    expect(readiness.recorded_decision).toBeNull()
    expect(readiness.blockers).toEqual(['The central Decision Queue review packet is missing.'])
  })

  it('fails closed when the central Decision Queue packet is malformed', () => {
    const candidate = item({ version: 'social-content-decision-review/v2' })

    const readiness = getSocialContentDecisionReadiness(candidate as never)

    expect(readiness.ready).toBe(false)
    expect(readiness.recorded_decision).toBeNull()
    expect(readiness.blockers).toEqual(['The central Decision Queue review packet is incomplete or malformed.'])
  })

  it('fails closed when one required receipt is missing', () => {
    const candidate = item()
    delete (candidate.rag_context.mobile_decision_review.receipts as Record<string, unknown>).privacy

    const readiness = getSocialContentDecisionReadiness(candidate as never)

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('The central Decision Queue review packet is incomplete or malformed.')
  })

  it('fails closed for stale content and receipt versions', () => {
    const candidate = item()
    candidate.updated_at = '2026-10-12T18:31:00.000Z'

    const readiness = getSocialContentDecisionReadiness(candidate as never)

    expect(readiness.ready).toBe(false)
    expect(readiness.stale).toBe(true)
    expect(readiness.recorded_decision).toBeNull()
    expect(readiness.blockers).toContain('The review packet is stale for the current content version.')
  })

  it('reconciles a receipt-complete recorded approval with the post-decision content version', () => {
    const candidate = item({ next_gate: 'asset_packet' })
    candidate.updated_at = '2026-10-12T18:31:00.000Z'
    Object.assign(candidate.rag_context, {
      current_gate: 'asset_packet',
      latest_internal_decision_receipt_id: 'decision-receipt-1',
      latest_internal_decision: 'approve',
    })
    Object.assign(candidate, {
      recorded_internal_decision_receipt: {
        receipt_id: 'decision-receipt-1',
        decision: 'approve',
        reviewed_content_updated_at: VERSION,
        next_gate: 'asset_packet',
        verified: true,
      },
    })

    const readiness = getSocialContentDecisionReadiness(candidate as never)

    expect(readiness.ready).toBe(false)
    expect(readiness.stale).toBe(true)
    expect(readiness.blockers).toEqual([])
    expect(readiness.recorded_decision).toEqual({
      receipt_id: 'decision-receipt-1',
      decision: 'approve',
      reviewed_content_updated_at: VERSION,
      current_content_updated_at: '2026-10-12T18:31:00.000Z',
      next_gate: 'asset_packet',
    })
  })

  it('does not trust a claimed recorded decision when the post-decision gate does not match', () => {
    const candidate = item({ next_gate: 'asset_packet' })
    candidate.updated_at = '2026-10-12T18:31:00.000Z'
    Object.assign(candidate.rag_context, {
      current_gate: 'visual_review',
      latest_internal_decision_receipt_id: 'decision-receipt-1',
      latest_internal_decision: 'approve',
    })
    Object.assign(candidate, {
      recorded_internal_decision_receipt: {
        receipt_id: 'decision-receipt-1',
        decision: 'approve',
        reviewed_content_updated_at: VERSION,
        next_gate: 'asset_packet',
        verified: true,
      },
    })

    const readiness = getSocialContentDecisionReadiness(candidate as never)

    expect(readiness.recorded_decision).toBeNull()
    expect(readiness.blockers).toContain('The recorded decision receipt could not be verified against the immutable receipt store.')
    expect(readiness.blockers).toContain('The review packet is stale for the current content version.')
  })

  it('fails closed when recorded metadata has no server-verified immutable receipt', () => {
    const candidate = item({ next_gate: 'asset_packet' })
    candidate.updated_at = '2026-10-12T18:31:00.000Z'
    Object.assign(candidate.rag_context, {
      current_gate: 'asset_packet',
      latest_internal_decision_receipt_id: 'decision-receipt-1',
      latest_internal_decision: 'approve',
    })

    const readiness = getSocialContentDecisionReadiness(candidate as never)

    expect(readiness.recorded_decision).toBeNull()
    expect(readiness.blockers).toContain('The recorded decision receipt could not be verified against the immutable receipt store.')
  })

  it('fails closed when the server-verified receipt projection is bound to another receipt', () => {
    const candidate = item({ next_gate: 'asset_packet' })
    candidate.updated_at = '2026-10-12T18:31:00.000Z'
    Object.assign(candidate.rag_context, {
      current_gate: 'asset_packet',
      latest_internal_decision_receipt_id: 'decision-receipt-1',
      latest_internal_decision: 'approve',
    })
    Object.assign(candidate, {
      recorded_internal_decision_receipt: {
        receipt_id: 'another-receipt',
        decision: 'approve',
        reviewed_content_updated_at: VERSION,
        next_gate: 'asset_packet',
        verified: true,
      },
    })

    const readiness = getSocialContentDecisionReadiness(candidate as never)

    expect(readiness.recorded_decision).toBeNull()
    expect(readiness.blockers).toContain('The recorded decision receipt could not be verified against the immutable receipt store.')
  })

  it('fails closed when challenger review has not passed', () => {
    const candidate = item()
    candidate.rag_context.mobile_decision_review.receipts.challenger = receipt('pending')

    const readiness = getSocialContentDecisionReadiness(candidate as never)

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('Challenger receipt has not passed.')
  })

  it('builds a deterministic action- and version-bound idempotency key', () => {
    const first = socialContentDecisionIdempotencyKey({
      approvalId: 'approval-1',
      contentUpdatedAt: VERSION,
      decision: 'approve',
    })
    const replay = socialContentDecisionIdempotencyKey({
      approvalId: 'approval-1',
      contentUpdatedAt: VERSION,
      decision: 'approve',
    })
    const differentAction = socialContentDecisionIdempotencyKey({
      approvalId: 'approval-1',
      contentUpdatedAt: VERSION,
      decision: 'hold',
    })

    expect(replay).toBe(first)
    expect(differentAction).not.toBe(first)
  })
})
