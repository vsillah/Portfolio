/**
 * Reconcile `last_n8n_outreach_*` on `contact_submissions` using existing outreach_queue
 * rows (safety path if the insert trigger lags or missed).
 */
const STALE_N8N_PENDING_MS = 20 * 60 * 1000
/** Created_at can be a second before the trigger; allow slack vs last_n8n_outreach_triggered_at */
const N8N_QUEUE_RECONCILE_SKEW_MS = 2 * 60 * 1000

export function partitionN8nOutreachReconcile(
  contacts: Array<{
    id: number
    last_n8n_outreach_status: string | null
    last_n8n_outreach_triggered_at: string | null
  }>,
  messagesByContact: Record<
    number,
    Array<{ channel: string; created_at: string }>
  >,
  now = Date.now(),
): { toSuccess: number[]; toFail: number[] } {
  const toSuccess: number[] = []
  const toFail: number[] = []

  for (const c of contacts) {
    if (c.last_n8n_outreach_status !== 'pending' || !c.last_n8n_outreach_triggered_at) continue
    const t0 = new Date(c.last_n8n_outreach_triggered_at).getTime()
    if (Number.isNaN(t0)) continue
    if (now - t0 > STALE_N8N_PENDING_MS) {
      toFail.push(c.id)
      continue
    }
    const rows = messagesByContact[c.id] || []
    const hasEmail = rows.some(
      (m) =>
        m.channel === 'email' &&
        new Date(m.created_at).getTime() >= t0 - N8N_QUEUE_RECONCILE_SKEW_MS,
    )
    if (hasEmail) toSuccess.push(c.id)
  }
  return { toSuccess, toFail }
}
