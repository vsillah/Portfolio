/** Exact retained synthetic lineage. These identities are evidence, not releases. */
export const EVIDENCE_REPAIR_CANARY = {
  queueIds: [
    '7922d993-73a2-4b22-8738-6c8807d842e6',
    '93704b01-a909-49bb-92c7-4c49baf2bf2a',
  ],
  calendarIds: [
    '49cd7319-d142-4111-8ace-dbd55e4df8cf',
    'f3034dfb-9437-4fa6-894b-13368ebaf8e5',
  ],
  packetIds: [
    '876384e4-0957-40dc-b6f1-6ec70356c27d',
    '5a00f294-5ea8-4cfb-8ea0-b29027dbc21d',
    '5ecdeabf-9190-49ac-a0b1-da13efe51a35',
    '7296891e-e4a0-43ad-8871-8f5d5d3a7675',
  ],
  immutableReceiptId: '0685efcb-7af0-4fea-bf0f-60b97b1f7c3c',
} as const

export function excludeEvidenceRepairCanaries<T extends { not: (column: string, operator: string, value: string) => T }>(
  query: T,
  kind: 'queue' | 'calendar' | 'packet',
): T {
  const ids = kind === 'queue' ? EVIDENCE_REPAIR_CANARY.queueIds
    : kind === 'calendar' ? EVIDENCE_REPAIR_CANARY.calendarIds : EVIDENCE_REPAIR_CANARY.packetIds
  return query.not('id', 'in', `(${ids.join(',')})`)
}

export function isEvidenceRepairCanaryId(id: string | null | undefined, kind: 'queue' | 'calendar' | 'packet') {
  if (!id) return false
  const ids: readonly string[] = kind === 'queue' ? EVIDENCE_REPAIR_CANARY.queueIds
    : kind === 'calendar' ? EVIDENCE_REPAIR_CANARY.calendarIds : EVIDENCE_REPAIR_CANARY.packetIds
  return ids.includes(id)
}
