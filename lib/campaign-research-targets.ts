import type { AgentWorkItem } from './agent-work-items'
export type ResearchCalendarTarget = { id: string; campaign_id: string | null; social_content_id: string | null; channel: string; campaign_phase: string; authorization_status: string; metadata?: Record<string, unknown> | null }

export function isCampaignResearchTarget(item: Pick<AgentWorkItem, 'source_type' | 'metadata'>) {
  const m = item.metadata ?? {}
  return item.source_type === 'social_content_calendar_authorization' && m.draft_handoff_only === true
    && typeof m.campaign_id === 'string' && !!m.campaign_id
    && typeof m.calendar_item_id === 'string' && !!m.calendar_item_id
}

export function campaignResearchBlocker(item: AgentWorkItem, calendar?: ResearchCalendarTarget) {
  if (!isCampaignResearchTarget(item)) return 'Not a campaign draft handoff.'
  if (!calendar) return 'Calendar item unavailable. Open the campaign calendar to recover the handoff.'
  const m = item.metadata ?? {}
  const handoff = calendar.metadata?.platform_draft_handoff as { work_item_id?: string } | undefined
  if (calendar.authorization_status !== 'authorized') return 'Authorize the calendar handoff before linking evidence.'
  if (handoff?.work_item_id !== item.id || calendar.campaign_id !== m.campaign_id
    || calendar.social_content_id !== m.social_content_id || calendar.channel !== m.channel
    || calendar.campaign_phase !== m.campaign_phase) return 'Calendar handoff changed. Recover it in the campaign calendar.'
  return null
}

export function researchPacketBlocker(packet: { status: string; pattern_status: string; source_url: string; pattern_packet?: unknown }) {
  if (!['review_ready', 'approved'].includes(packet.status)) return 'Packet must be awaiting review or approved.'
  if (packet.pattern_status !== 'usable_framework') return 'A usable framework is required; review source-use boundaries first.'
  try { if (!['http:', 'https:'].includes(new URL(packet.source_url).protocol)) return 'A public source URL is required.' }
  catch { return 'A public source URL is required.' }
  if (!packet.pattern_packet || typeof packet.pattern_packet !== 'object' || Array.isArray(packet.pattern_packet)
    || !Object.keys(packet.pattern_packet).length) return 'A nonempty pattern packet is required.'
  return null
}
