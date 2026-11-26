import { EVIDENCE_REPAIR_CANARY, isEvidenceRepairCanaryId } from '@/lib/evidence-repair-canary'

type Run = {
  id: string
  status: string
  metadata: unknown
  protectedDependents: boolean
}

/** Read-only nomination. A separate reviewed operation must perform any deletion. */
export function planEvidenceRepairCanaryRunCleanup(runs: Run[], exactRunIds: string[]) {
  const requested = new Set(exactRunIds)
  if (requested.size !== exactRunIds.length || requested.size === 0) return []
  const byId = new Map(runs.map(run => [run.id, run]))
  if (byId.size !== runs.length || [...requested].some(id => !byId.has(id))) return []
  return [...requested].every(id => {
    const run = byId.get(id)!
    const metadata = run.metadata && typeof run.metadata === 'object' && !Array.isArray(run.metadata)
      ? run.metadata as Record<string, unknown> : {}
    const evidence = metadata.synthetic_evidence && typeof metadata.synthetic_evidence === 'object'
      && !Array.isArray(metadata.synthetic_evidence)
      ? metadata.synthetic_evidence as Record<string, unknown> : {}
    return ['completed', 'failed', 'cancelled'].includes(run.status)
      && run.protectedDependents === false
      && evidence.kind === 'evidence_repair_canary'
      && evidence.version === 1
      && isEvidenceRepairCanaryId(evidence.queue_id as string, 'queue')
      && isEvidenceRepairCanaryId(evidence.calendar_item_id as string, 'calendar')
      && evidence.receipt_id !== EVIDENCE_REPAIR_CANARY.immutableReceiptId
  }) ? [...requested] : []
}
