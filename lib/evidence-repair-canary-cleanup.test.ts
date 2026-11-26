import { describe, expect, it } from 'vitest'
import { EVIDENCE_REPAIR_CANARY } from './evidence-repair-canary'
import { planEvidenceRepairCanaryRunCleanup } from './evidence-repair-canary-cleanup'

const run = (overrides: Record<string, unknown> = {}) => ({
  id: 'canary-run-1', status: 'completed', protectedDependents: false,
  metadata: { synthetic_evidence: { kind: 'evidence_repair_canary', version: 1,
    queue_id: EVIDENCE_REPAIR_CANARY.queueIds[0], calendar_item_id: EVIDENCE_REPAIR_CANARY.calendarIds[0] } },
  ...overrides,
})

describe('bounded synthetic agent-run cleanup', () => {
  it('nominates only exact, terminal, linked synthetic runs after dependency review', () => {
    expect(planEvidenceRepairCanaryRunCleanup([run()], ['canary-run-1'])).toEqual(['canary-run-1'])
  })

  it('fails the entire batch closed for unrelated, running, receipt-linked, or unreviewed runs', () => {
    const real = run({ id: 'real-run', metadata: {} })
    expect(planEvidenceRepairCanaryRunCleanup([run(), real], ['canary-run-1', 'real-run'])).toEqual([])
    expect(planEvidenceRepairCanaryRunCleanup([run({ status: 'running' })], ['canary-run-1'])).toEqual([])
    expect(planEvidenceRepairCanaryRunCleanup([run({ protectedDependents: true })], ['canary-run-1'])).toEqual([])
    expect(planEvidenceRepairCanaryRunCleanup([run()], ['missing-run'])).toEqual([])
    expect(planEvidenceRepairCanaryRunCleanup([run()], ['canary-run-1', 'canary-run-1'])).toEqual([])
    expect(planEvidenceRepairCanaryRunCleanup([run({ metadata: { synthetic_evidence: {
      kind: 'evidence_repair_canary', version: 1, queue_id: EVIDENCE_REPAIR_CANARY.queueIds[1],
      calendar_item_id: EVIDENCE_REPAIR_CANARY.calendarIds[1], receipt_id: EVIDENCE_REPAIR_CANARY.immutableReceiptId,
    } } })], ['canary-run-1'])).toEqual([])
  })
})
