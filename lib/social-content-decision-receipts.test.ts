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
    expect(readiness.packet?.next_gate).toBe('visual_review')
    expect(readiness.packet?.candidate_projection).toEqual({ headline: 'Read-only candidate' })
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
    expect(readiness.blockers).toContain('The review packet is stale for the current content version.')
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
