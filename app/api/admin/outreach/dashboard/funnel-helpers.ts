export type FunnelContact = {
  lead_score: number | null
  outreach_status: string
}

export type SourceFunnelContact = FunnelContact & {
  lead_source: string | null
}

/**
 * Helper to compute funnel stats from a list of contacts.
 */
export function computeFunnel(contacts: FunnelContact[]) {
  const total = contacts.length
  const enriched = contacts.filter(c => c.lead_score !== null).length
  const contacted = contacts.filter(c =>
    ['sequence_active', 'replied', 'booked', 'no_response'].includes(c.outreach_status)
  ).length
  const replied = contacts.filter(c => c.outreach_status === 'replied').length
  const booked = contacts.filter(c => c.outreach_status === 'booked').length

  return {
    total,
    enriched,
    contacted,
    replied,
    booked,
    reply_rate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
    booking_rate: contacted > 0 ? Math.round((booked / contacted) * 100) : 0,
  }
}

/**
 * Helper to compute per-source funnel breakdown.
 */
export function computeFunnelBySource(contacts: SourceFunnelContact[]) {
  const bySource: Record<string, {
    total: number
    enriched: number
    contacted: number
    replied: number
    booked: number
    opted_out: number
    no_response: number
  }> = {}

  for (const c of contacts) {
    const source = c.lead_source || 'unknown'
    if (!bySource[source]) {
      bySource[source] = {
        total: 0, enriched: 0, contacted: 0,
        replied: 0, booked: 0, opted_out: 0, no_response: 0,
      }
    }
    bySource[source].total++
    if (c.lead_score !== null) bySource[source].enriched++
    if (c.outreach_status === 'sequence_active') bySource[source].contacted++
    if (c.outreach_status === 'replied') bySource[source].replied++
    if (c.outreach_status === 'booked') bySource[source].booked++
    if (c.outreach_status === 'opted_out') bySource[source].opted_out++
    if (c.outreach_status === 'no_response') bySource[source].no_response++
  }

  return bySource
}
