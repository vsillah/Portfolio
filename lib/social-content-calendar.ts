import type { AttractionCampaign } from '@/lib/campaigns'

export const SOCIAL_CONTENT_CALENDAR_CHANNELS = [
  'linkedin',
  'youtube_shorts',
  'instagram_reels',
  'thumbnail',
] as const

export const SOCIAL_CONTENT_CAMPAIGN_PHASES = ['tease', 'teach', 'proof', 'offer'] as const

export const SOCIAL_CONTENT_CALENDAR_DUE_STATUSES = [
  'planned',
  'due_soon',
  'due_now',
  'past_due',
  'completed',
  'cancelled',
] as const

export const SOCIAL_CONTENT_CALENDAR_AUTHORIZATION_STATUSES = [
  'not_required',
  'pending',
  'authorized',
  'rejected',
  'expired',
] as const

export type SocialContentCalendarChannel = (typeof SOCIAL_CONTENT_CALENDAR_CHANNELS)[number]
export type SocialContentCampaignPhase = (typeof SOCIAL_CONTENT_CAMPAIGN_PHASES)[number]
export type SocialContentCalendarDueStatus = (typeof SOCIAL_CONTENT_CALENDAR_DUE_STATUSES)[number]
export type SocialContentCalendarAuthorizationStatus =
  (typeof SOCIAL_CONTENT_CALENDAR_AUTHORIZATION_STATUSES)[number]

export type SocialContentCalendarItem = {
  id: string
  campaign_id: string | null
  agent_work_item_id: string | null
  social_content_id: string | null
  channel: SocialContentCalendarChannel
  campaign_phase: SocialContentCampaignPhase
  title: string
  planned_angle: string | null
  scheduled_for: string
  due_status: SocialContentCalendarDueStatus
  authorization_status: SocialContentCalendarAuthorizationStatus
  authorization_due_at: string | null
  last_pinged_at: string | null
  autonomy_eligible: boolean
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
  attraction_campaigns?: {
    id: string
    name: string
    slug: string
    status: string
    starts_at: string | null
    ends_at: string | null
  } | null
  agent_work_items?: {
    id: string
    title: string
    status: string
    priority?: string | null
  } | null
  social_content_queue?: {
    id: string
    status: string
    post_text?: string | null
    scheduled_for?: string | null
  } | null
}

export const CALENDAR_SIDE_EFFECTS = {
  provider_generation: false,
  upload: false,
  external_schedule: false,
  publish: false,
  external_post: false,
} as const

export const CALENDAR_CHANNEL_LABELS: Record<SocialContentCalendarChannel, string> = {
  linkedin: 'LinkedIn',
  youtube_shorts: 'YouTube Shorts',
  instagram_reels: 'Instagram Reels',
  thumbnail: 'Thumbnail',
}

export const CAMPAIGN_PHASE_LABELS: Record<SocialContentCampaignPhase, string> = {
  tease: 'Tease',
  teach: 'Teach',
  proof: 'Proof',
  offer: 'Offer',
}

export function isCalendarChannel(value: unknown): value is SocialContentCalendarChannel {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CALENDAR_CHANNELS.includes(value as SocialContentCalendarChannel)
}

export function isCampaignPhase(value: unknown): value is SocialContentCampaignPhase {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CAMPAIGN_PHASES.includes(value as SocialContentCampaignPhase)
}

export function isDueStatus(value: unknown): value is SocialContentCalendarDueStatus {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CALENDAR_DUE_STATUSES.includes(value as SocialContentCalendarDueStatus)
}

export function isAuthorizationStatus(value: unknown): value is SocialContentCalendarAuthorizationStatus {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CALENDAR_AUTHORIZATION_STATUSES.includes(
      value as SocialContentCalendarAuthorizationStatus,
    )
}

export function normalizeCalendarChannel(value: unknown): SocialContentCalendarChannel {
  return isCalendarChannel(value) ? value : 'linkedin'
}

export function normalizeCampaignPhase(value: unknown): SocialContentCampaignPhase {
  return isCampaignPhase(value) ? value : 'tease'
}

export function normalizeDueStatus(value: unknown): SocialContentCalendarDueStatus {
  return isDueStatus(value) ? value : 'planned'
}

export function normalizeAuthorizationStatus(value: unknown): SocialContentCalendarAuthorizationStatus {
  return isAuthorizationStatus(value) ? value : 'pending'
}

export function defaultAuthorizationDueAt(scheduledFor: string | Date) {
  const scheduled = typeof scheduledFor === 'string' ? new Date(scheduledFor) : scheduledFor
  if (!Number.isFinite(scheduled.getTime())) return null
  const due = new Date(scheduled.getTime() - 24 * 60 * 60 * 1000)
  return due.toISOString()
}

export function deriveDueStatus(
  scheduledFor: string | Date,
  now: Date = new Date(),
): SocialContentCalendarDueStatus {
  const scheduled = typeof scheduledFor === 'string' ? new Date(scheduledFor) : scheduledFor
  if (!Number.isFinite(scheduled.getTime())) return 'planned'

  const diffMs = scheduled.getTime() - now.getTime()
  if (diffMs < -2 * 60 * 60 * 1000) return 'past_due'
  if (diffMs <= 2 * 60 * 60 * 1000) return 'due_now'
  if (diffMs <= 24 * 60 * 60 * 1000) return 'due_soon'
  return 'planned'
}

export function dueGateWindow(scheduledFor: string | Date, now: Date = new Date()): '24h' | '2h' | null {
  const scheduled = typeof scheduledFor === 'string' ? new Date(scheduledFor) : scheduledFor
  if (!Number.isFinite(scheduled.getTime())) return null
  const diffMs = scheduled.getTime() - now.getTime()
  if (diffMs < -2 * 60 * 60 * 1000 || diffMs > 24 * 60 * 60 * 1000) return null
  if (diffMs <= 2 * 60 * 60 * 1000) return '2h'
  return '24h'
}

export function parseMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function atLocalWorkHour(date: Date, hour = 10) {
  const next = new Date(date)
  next.setHours(hour, 0, 0, 0)
  return next
}

function campaignDateAt(start: Date, end: Date, ratio: number) {
  const time = start.getTime() + (end.getTime() - start.getTime()) * ratio
  return atLocalWorkHour(new Date(time))
}

export function campaignContentPlanSlots(campaign: Pick<AttractionCampaign, 'name' | 'starts_at' | 'ends_at'>) {
  const start = dateOrNull(campaign.starts_at) ?? addDays(new Date(), 1)
  const end = dateOrNull(campaign.ends_at) ?? addDays(start, 21)
  const hasUsableWindow = end.getTime() > start.getTime()
  const baseStart = atLocalWorkHour(start)

  const scheduledDates = hasUsableWindow
    ? [
        campaignDateAt(start, end, 0.1),
        campaignDateAt(start, end, 0.35),
        campaignDateAt(start, end, 0.65),
        campaignDateAt(start, end, 0.9),
      ]
    : [baseStart, addDays(baseStart, 3), addDays(baseStart, 6), addDays(baseStart, 9)]

  const angles: Record<SocialContentCampaignPhase, string> = {
    tease: 'Open with a small tension, observation, or question that makes the campaign problem visible.',
    teach: 'Give the audience a useful framework or operating lesson connected to the campaign promise.',
    proof: 'Show evidence, a shipped example, client-safe result, or lived project insight that earns trust.',
    offer: 'Make the clearest campaign offer, bonus, release, or invitation as the campaign reaches the shout moment.',
  }

  return SOCIAL_CONTENT_CAMPAIGN_PHASES.map((phase, index) => ({
    campaign_phase: phase,
    channel: 'linkedin' as SocialContentCalendarChannel,
    title: `${CAMPAIGN_PHASE_LABELS[phase]}: ${campaign.name}`,
    planned_angle: angles[phase],
    scheduled_for: scheduledDates[index].toISOString(),
    authorization_due_at: defaultAuthorizationDueAt(scheduledDates[index]),
    authorization_status: 'pending' as SocialContentCalendarAuthorizationStatus,
    due_status: deriveDueStatus(scheduledDates[index]),
    autonomy_eligible: false,
    metadata: {
      generated_from: 'campaign_content_plan',
      campaign_arc: 'whisper_to_shout',
      external_execution_enabled: false,
    },
  }))
}
