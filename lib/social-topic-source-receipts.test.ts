import { describe, expect, it } from 'vitest'
import {
  buildApprovedSourceProjection,
  sanitizeApprovedSourceSummary,
  stableProductIdentity,
} from './social-topic-source-receipts'

describe('social topic source receipts', () => {
  it('deduplicates known product names into stable identities', () => {
    expect(stableProductIdentity('Dark-Castle-Chess preview')).toBe('dark_castle_chess')
    expect(stableProductIdentity('Agentified book launch')).toBe('agentified')
    expect(stableProductIdentity('ReversR CAD')).toBe('reversr')
  })

  it('redacts direct identifiers and secret-shaped values from approved summaries', () => {
    const summary = sanitizeApprovedSourceSummary('Email me at person@example.com or 202-555-0198. Token ghp_1234567890abcdefghijklmnop.')
    expect(summary).toContain('[email redacted]')
    expect(summary).toContain('[phone redacted]')
    expect(summary).toContain('[secret redacted]')
    expect(summary).not.toContain('person@example.com')
  })

  it('builds deterministic approved receipts without raw content', () => {
    const input = {
      sourceGroup: 'codex_insights',
      sourceKind: 'open_brain_approved_projection',
      sourceId: 'proposal-1',
      productIdentity: 'Dark Castle Chess',
      lifecycleStage: 'insight' as const,
      label: 'Learning mode insight',
      approvedSummary: 'A privacy-safe summary of the learning mode decision.',
      privacyClassification: 'public_safe' as const,
      provenance: 'open_brain:proposal-1:sources-checked',
      approvedAt: '2026-10-10T14:00:00.000Z',
      approvedBy: 'reviewer-1',
    }
    const first = buildApprovedSourceProjection(input)
    const second = buildApprovedSourceProjection(input)
    expect(first.receipt_id).toBe(second.receipt_id)
    expect(first.product_identity).toBe('dark_castle_chess')
    expect(first.approval_status).toBe('approved')
    expect(first.raw_content_included).toBe(false)
  })

  it('fails closed without approval provenance', () => {
    expect(() => buildApprovedSourceProjection({
      sourceGroup: 'meeting_summaries',
      sourceKind: 'meeting_summary',
      sourceId: 'meeting-1',
      lifecycleStage: 'insight',
      label: 'Meeting summary',
      approvedSummary: 'Approved summary',
      privacyClassification: 'client_safe_summary',
      provenance: '',
      approvedAt: '2026-10-10T14:00:00.000Z',
      approvedBy: 'reviewer-1',
    })).toThrow(/provenance/i)
  })
})
