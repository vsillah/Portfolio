/**
 * Reconcile `last_vep_status` on `contact_submissions` when the VEP-001
 * callback never arrives (n8n crash without an error handler workflow,
 * dev→prod webhook mis-routing before we hardened the pipeline, network
 * blip, etc).
 *
 * Sibling of `lib/n8n-outreach-contact-status.ts#partitionN8nOutreachReconcile`.
 * The admin outreach page is the authoritative surface for `last_vep_status`,
 * so it runs this on every load to self-heal stalled rows.
 */

/**
 * How long a `last_vep_status = 'pending'` row can sit before we flip it to
 * `failed`. WF-VEP-001 runs typically complete in < 20s; 15 min is generous
 * and still tighter than the outreach 20 min threshold.
 *
 * Must stay ≥ the UI's `vepStaleMs` (10 min in `app/admin/outreach/page.tsx`)
 * so a user sees "Stalled — retry" before the sweeper closes the row.
 */
export const STALE_VEP_PENDING_MS = 15 * 60 * 1000

export function partitionVepReconcile(
  contacts: Array<{
    id: number
    last_vep_status: string | null
    last_vep_triggered_at: string | null
  }>,
  now = Date.now(),
): { toFail: number[] } {
  const toFail: number[] = []

  for (const c of contacts) {
    if (c.last_vep_status !== 'pending' || !c.last_vep_triggered_at) continue
    const t0 = new Date(c.last_vep_triggered_at).getTime()
    if (Number.isNaN(t0)) continue
    if (now - t0 > STALE_VEP_PENDING_MS) {
      toFail.push(c.id)
    }
  }

  return { toFail }
}
