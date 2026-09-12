// Read-only UI projection. Server release guards remain authoritative.
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const pending = ['claimed', 'submitting', 'publishing', 'scheduled']
const uncertain = ['uncertain', 'ambiguous']
export function socialReleaseReview(item: unknown, platform?: string) {
  const row = record(item)
  const gate = record(record(row.rag_context).platform_submission_gate)
  const confirmedPlatforms = record(gate.confirmed_platforms)
  const partial = gate.status === 'partially_submitted' || Object.keys(confirmedPlatforms).length > 0
  const all = Array.isArray(row.publishes) ? row.publishes.map(record) : []
  const selected = platform ? all.filter(pub => pub.platform === platform) : all
  const confirmed = (pub: Record<string, unknown>) => pub.status === 'published' && typeof pub.platform_post_id === 'string' && pub.platform_post_id.length > 0
  // Match backend hasAmbiguousSocialPublishRows: only pristine pending rows or
  // published rows with a provider ID are safe, regardless of a status label.
  const ambiguous = (pub: Record<string, unknown>) => pub.status === 'published' ? !confirmed(pub)
    : pub.status !== 'pending' || Boolean(pub.platform_post_id || pub.platform_post_url || pub.published_at)
  const confirmedMapMismatch = Object.entries(confirmedPlatforms).some(([target, providerId]) => !all.some(pub => pub.platform === target && confirmed(pub) && pub.platform_post_id === providerId))
  const hasUncertain = uncertain.includes(String(gate.status)) || uncertain.includes(String(row.status)) || all.some(ambiguous) || confirmedMapMismatch || (gate.status === 'submitted' && !all.some(confirmed))
  const inFlight = pending.includes(String(gate.status)) || pending.includes(String(row.status)) || all.some(pub => pending.includes(String(pub.status)))
  const hasConfirmed = selected.some(confirmed)
  const locked = hasUncertain || inFlight || hasConfirmed || gate.status === 'submitted' || (!partial && all.some(confirmed)) || Boolean(partial && platform && !selected.some(pub => pub.status === 'pending'))
  const label = platform && hasConfirmed && !selected.some(ambiguous) ? 'Post confirmed' : hasUncertain ? (all.some(confirmed) ? 'Partially confirmed · reconcile remaining results' : 'Outcome uncertain · reconcile receipts')
    : inFlight ? 'Submission pending · refresh evidence'
      : partial ? (hasConfirmed && platform ? 'Post confirmed' : 'Selected platforms confirmed · review remaining platforms')
      : hasConfirmed ? (all.some(pub => !confirmed(pub)) ? 'Partially confirmed · review receipts' : 'Post confirmed')
        : gate.status === 'submitted' ? 'Release recorded · review receipts' : null
  return { locked, label, phase: hasUncertain ? 'Reconcile' : inFlight ? 'In progress' : partial ? 'Partial' : hasConfirmed ? 'Confirmed' : null, continuation: partial && !locked && selected.some(pub => pub.status === 'pending') }
}
