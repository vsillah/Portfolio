export type AuditSummary = {
  id: string
  completed_at: string | null
  business_name: string | null
  report_tier: string | null
  audit_type: string | null
}

export function dedupePickLatest(rows: AuditSummary[]): AuditSummary | null {
  const byId = new Map<string, AuditSummary>()
  for (const r of rows) {
    const id = String(r.id)
    const prev = byId.get(id)
    if (!prev) {
      byId.set(id, r)
      continue
    }
    const tNew = new Date(r.completed_at || 0).getTime()
    const tOld = new Date(prev.completed_at || 0).getTime()
    if (tNew >= tOld) byId.set(id, r)
  }
  const list = [...byId.values()]
  if (list.length === 0) return null
  return list.sort(
    (a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
  )[0]!
}
