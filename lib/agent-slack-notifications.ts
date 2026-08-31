import { createHash } from 'crypto'
import { endAgentRun, recordAgentEvent, startAgentRun } from '@/lib/agent-run'
import { listAgentWorkItems, type AgentWorkItem } from '@/lib/agent-work-items'
import { AGENT_ORGANIZATION } from '@/lib/agent-organization'
import { mrkdwn, slackButton, truncateSlack, type SlackBlock } from '@/lib/agent-slack-blocks'
import { buildAgentMissionControlSnapshot } from '@/lib/agent-mission-control'
import {
  highSignalInsightsSlackBlocks,
  highSignalInsightsSlackText,
} from '@/lib/agent-slack-insights'
import { supabaseAdmin } from '@/lib/supabase'
import type { PublishStatus, SocialPlatform } from '@/lib/social-content'
import {
  buildPlatformOrchestrationPlan,
  isPlatformSubmissionGateApproved,
} from '@/lib/social-platform-orchestration'
import {
  canSlackDecideCommentReply,
  listSocialCommentAttentionRows,
  socialCommentDeepLink,
  socialCommentDraftState,
  socialCommentPostTitle,
  type SocialCommentAttentionRow,
} from '@/lib/social-comment-attention'
import {
  CALENDAR_CHANNEL_LABELS,
  calendarApprovalGateSummary,
  calendarDueGatePingAlreadySent,
  dueGateWindow,
  type SocialContentCalendarItem,
} from '@/lib/social-content-calendar'

export type AgentSlackNotificationKind =
  | 'pending_approvals'
  | 'blockers'
  | 'stale_runs'
  | 'review_ready'
  | 'goal_decisions'
  | 'high_signal_insights'
  | 'social_calendar_approval_due'
  | 'social_publish_gate_due'
  | 'social_comment_attention_due'
  | 'standup_blockers'
  | 'selected_agent_question'

export type AgentSlackNotificationInput = {
  kind: AgentSlackNotificationKind
  message?: string
  targetAgentKeys?: string[]
  goalId?: string | null
  force?: boolean
  dedupeKey?: string | null
  dedupeWindowHours?: number | null
  actorLabel?: string | null
  triggerSource?: string | null
}

export type AgentSlackNotificationResult = {
  ok: boolean
  runId: string
  sent: boolean
  skipped: boolean
  deduped: boolean
  reason?: string
  itemCount: number
  text: string
}

type PendingApprovalRow = {
  id: string
  run_id: string
  approval_type: string
  status: string
  metadata: Record<string, unknown> | null
}

type AgentRunSummaryRow = {
  id: string
  title: string | null
  current_step: string | null
  status: string | null
  runtime?: string | null
  error_message?: string | null
  started_at?: string | null
}

type SlackDeliveryResult = {
  sent: boolean
  reason: string | null
  mode: 'bot' | 'webhook' | 'none'
  channel?: string | null
  ts?: string | null
}

type ScheduledSocialContentRow = {
  id: string
  topic_extracted?: unknown
  platform?: SocialPlatform | null
  target_platforms?: SocialPlatform[] | null
  status?: string | null
  scheduled_for?: string | null
  post_text?: string | null
  image_url?: string | null
  video_url?: string | null
  carousel_slide_urls?: string[] | null
  youtube_title?: string | null
  youtube_description?: string | null
  rag_context?: unknown
}

type SocialPublishRow = {
  content_id: string
  platform: SocialPlatform
  status: PublishStatus
  platform_post_url: string | null
}

type SocialContentConfigRow = {
  platform: SocialPlatform
  credentials: Record<string, string>
  settings: Record<string, string>
  is_active: boolean
}

type SocialPublishAttentionDetail = {
  platform: SocialPlatform
  label: string
  detail: string
  nextAction: string
  kind: 'orchestration_blocker' | 'stale_schedule'
}

type SocialCalendarApprovalAttentionItem = {
  row: SocialContentCalendarItem
  window: '24h' | '2h' | 'stale'
  stale: boolean
}

const DEFAULT_SCHEDULED_PUBLISH_STALE_HOURS = 24
const MAX_SCHEDULED_PUBLISH_STALE_HOURS = 7 * 24

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PORTFOLIO_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://amadutown.com'
  ).replace(/\/$/, '')
}

function socialContentGateReminderWindowHours() {
  const value = Number(process.env.SOCIAL_CONTENT_GATE_REMINDER_WINDOW_HOURS ?? 48)
  return Number.isFinite(value) && value > 0 ? value : 48
}

function socialContentGateReminderLookbackHours() {
  const maximumHours = 30 * 24
  const value = Number(process.env.SOCIAL_CONTENT_GATE_REMINDER_LOOKBACK_HOURS ?? maximumHours)
  if (!Number.isFinite(value) || value <= 0) return maximumHours
  return Math.min(value, maximumHours)
}

function socialContentScheduledPublishStaleHours() {
  const value = Number(
    process.env.SOCIAL_CONTENT_SCHEDULED_PUBLISH_STALE_HOURS
      ?? DEFAULT_SCHEDULED_PUBLISH_STALE_HOURS,
  )
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SCHEDULED_PUBLISH_STALE_HOURS
  return Math.min(Math.max(value, 1), MAX_SCHEDULED_PUBLISH_STALE_HOURS)
}

function socialCalendarApprovalReminderWindowHours() {
  const value = Number(process.env.SOCIAL_CALENDAR_APPROVAL_REMINDER_WINDOW_HOURS ?? 24)
  return Number.isFinite(value) && value > 0 ? value : 24
}

function socialCalendarApprovalReminderLookbackHours() {
  const maximumHours = 30 * 24
  const value = Number(process.env.SOCIAL_CALENDAR_APPROVAL_REMINDER_LOOKBACK_HOURS ?? maximumHours)
  if (!Number.isFinite(value) || value <= 0) return maximumHours
  return Math.min(value, maximumHours)
}

function agentUrl(path: string) {
  return `${baseUrl()}${path}`
}

function agentDisplayName(agentKey: string) {
  return AGENT_ORGANIZATION.find((agent) => agent.key === agentKey)?.name ?? agentKey
}

function dedupeWindowKey(windowHours = 1) {
  const hours = Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 1
  const windowMs = hours * 60 * 60 * 1000
  return new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString()
}

function normalizeTargetAgentKeys(keys?: string[]) {
  return [...new Set((keys ?? []).map((key) => key.trim()).filter(Boolean))].sort()
}

function notificationIdempotencyKey(input: AgentSlackNotificationInput) {
  const targetKey = normalizeTargetAgentKeys(input.targetAgentKeys).join(',') || 'all'
  const goalKey = input.goalId || 'no-goal'
  const contentKey = input.dedupeKey?.trim() || 'default'
  return `slack-mobile-notification:${input.kind}:${goalKey}:${targetKey}:${contentKey}:${dedupeWindowKey(input.dedupeWindowHours ?? 1)}`
}

async function existingNotificationRun(idempotencyKey: string) {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .select('id, status, metadata')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (error) return null
  return data as { id: string; status?: string | null; metadata?: Record<string, unknown> | null } | null
}

async function pendingApprovals(limit = 5) {
  if (!supabaseAdmin) throw new Error('Database not available')
  const { data, error } = await supabaseAdmin
    .from('agent_approvals')
    .select('id, run_id, approval_type, status, metadata')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`Failed to read pending approvals: ${error.message}`)
  return (data ?? []) as PendingApprovalRow[]
}

async function runsById(runIds: string[]) {
  if (!supabaseAdmin || !runIds.length) return new Map<string, AgentRunSummaryRow>()
  const { data } = await supabaseAdmin
    .from('agent_runs')
    .select('id, title, current_step, status')
    .in('id', runIds)
  const rows = (data ?? []) as AgentRunSummaryRow[]
  return new Map(rows.map((row) => [row.id, row]))
}

function workItemHref(item: AgentWorkItem) {
  if (item.active_run_id) return agentUrl(`/admin/agents/runs/${item.active_run_id}`)
  if (item.source_run_id) return agentUrl(`/admin/agents/runs/${item.source_run_id}`)
  return agentUrl(`/admin/agents/swarm-board?work_item=${encodeURIComponent(item.id)}`)
}

function prioritySort(left: AgentWorkItem, right: AgentWorkItem) {
  const weight = { urgent: 4, high: 3, medium: 2, low: 1 }
  return weight[right.priority] - weight[left.priority] || right.updated_at.localeCompare(left.updated_at)
}

function filterTargetAgents(items: AgentWorkItem[], targetAgentKeys: string[]) {
  if (!targetAgentKeys.length) return items
  return items.filter((item) => item.owner_agent_key && targetAgentKeys.includes(item.owner_agent_key))
}

function itemSummary(item: AgentWorkItem) {
  const owner = item.owner_agent_key ?? 'unassigned'
  const blocker = item.blocker_summary ? `\nBlocker: ${truncateSlack(item.blocker_summary, 140)}` : ''
  const next = item.validation_summary ? `\nNext: ${truncateSlack(item.validation_summary, 140)}` : ''
  return `*${truncateSlack(item.title, 110)}*\nOwner: \`${owner}\` - Status: \`${item.status}\` - Priority: \`${item.priority}\`${blocker}${next}`
}

function workItemPrimaryButton(item: AgentWorkItem, kind: AgentSlackNotificationKind) {
  if (!item.owner_agent_key) {
    return slackButton({
      label: 'Assign owner',
      actionId: 'agent_work_assign_captain',
      value: { action: 'work.assign', workItemId: item.id, agentKey: 'integration-captain' },
      style: 'primary',
    })
  }
  if (kind === 'review_ready' || item.status === 'ready_for_review' || item.status === 'ready_for_merge') {
    return slackButton({
      label: 'Request revision',
      actionId: 'agent_work_revision',
      value: {
        action: 'work.revision',
        workItemId: item.id,
        runId: item.active_run_id ?? undefined,
        note: 'Revision requested from Slack notification.',
      },
    })
  }
  if (item.status === 'blocked' || item.blocker_summary) {
    return slackButton({
      label: 'Acknowledge',
      actionId: 'agent_work_acknowledge_blocker',
      value: {
        action: 'work.acknowledge',
        workItemId: item.id,
        runId: item.active_run_id ?? undefined,
        note: 'Blocker acknowledged from Slack notification.',
      },
    })
  }
  return slackButton({
    label: 'Ask Shaka',
    actionId: 'agent_work_ask_shaka',
    value: { action: 'work.ask_shaka', workItemId: item.id, runId: item.active_run_id ?? undefined },
  })
}

function workItemContextButton(item: AgentWorkItem) {
  return slackButton({
    label: item.active_run_id || item.source_run_id ? 'Open trace' : 'Open Kanban',
    actionId: item.active_run_id || item.source_run_id ? 'open_trace' : 'open_kanban',
    url: workItemHref(item),
  })
}

function formatScheduledFor(value: string | null | undefined) {
  if (!value) return 'No scheduled time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(date)
}

function socialCalendarApprovalDeepLink(row: SocialContentCalendarItem) {
  const gate = calendarApprovalGateSummary(row)
  const socialContentId = row.social_content_queue?.id ?? row.social_content_id
  if (socialContentId) return socialContentGateDeepLink(socialContentId, gate.deepLinkStep)
  return `/admin/agents/content-intelligence?section=calendar&calendar_item=${encodeURIComponent(row.id)}#content-calendar-gate`
}

function socialContentGateDeepLink(id: string, step: 'copy' | 'visuals' | 'draft' | 'submit' | 'status') {
  const sectionIds = {
    copy: 'social-copy-gate',
    visuals: 'social-visual-assets-gate',
    draft: 'social-draft-approval-gate',
    submit: 'social-platform-submission-gate',
    status: 'social-publication-status-gate',
  }
  return `/admin/social-content/${id}?step=${step}#${sectionIds[step]}`
}

function socialCalendarApprovalDedupeKey(items: SocialCalendarApprovalAttentionItem[]) {
  if (!items.length) return 'social_calendar_approval_due:none'
  const parts = items
    .map(({ row, window }) => {
      const gate = calendarApprovalGateSummary(row)
      return `${row.id}:${gate.kind}:${window}`
    })
    .sort()
    .join('|')
  return `social_calendar_approval_due:${createHash('sha256').update(parts).digest('hex').slice(0, 16)}`
}

function calendarPingAlreadySent(row: SocialContentCalendarItem, window: '24h' | '2h') {
  return calendarDueGatePingAlreadySent(row, window)
}

async function socialCalendarApprovalRows(limit = 10): Promise<SocialCalendarApprovalAttentionItem[]> {
  if (!supabaseAdmin) throw new Error('Database not available')

  const now = new Date()
  const startsAt = new Date(now.getTime() - socialCalendarApprovalReminderLookbackHours() * 60 * 60 * 1000)
  const endsAt = new Date(now.getTime() + socialCalendarApprovalReminderWindowHours() * 60 * 60 * 1000)
  const { data, error } = await supabaseAdmin
    .from('social_content_calendar_items')
    .select(`
      *,
      social_content_queue (
        id, status, platform, target_platforms, post_text, scheduled_for, rag_context,
        social_content_publishes (id, platform, status)
      )
    `)
    .eq('authorization_status', 'pending')
    .gte('scheduled_for', startsAt.toISOString())
    .lte('scheduled_for', endsAt.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to read calendar approval gates: ${error.message}`)
  const seenIds = new Set<string>()
  return ((data ?? []) as SocialContentCalendarItem[])
    .filter((row) => {
      if (seenIds.has(row.id)) return false
      seenIds.add(row.id)
      return row.due_status !== 'completed' && row.due_status !== 'cancelled'
    })
    .map((row): SocialCalendarApprovalAttentionItem | null => {
      const window = dueGateWindow(row.scheduled_for, now)
      const scheduledAt = new Date(row.scheduled_for).getTime()
      const stale = Number.isFinite(scheduledAt) && scheduledAt + 2 * 60 * 60 * 1000 < now.getTime()
      if (stale) return { row, window: 'stale', stale: true }
      if (!window || calendarPingAlreadySent(row, window)) return null
      return { row, window, stale: false }
    })
    .filter((item): item is SocialCalendarApprovalAttentionItem => item !== null)
    .slice(0, limit)
}

function socialContentTitle(row: ScheduledSocialContentRow) {
  const topicExtracted = row.topic_extracted && typeof row.topic_extracted === 'object'
    ? row.topic_extracted as Record<string, unknown>
    : null
  const topic = typeof topicExtracted?.topic === 'string' ? topicExtracted.topic.trim() : ''
  const angle = typeof topicExtracted?.angle === 'string' ? topicExtracted.angle.trim() : ''
  return topic
    || angle
    || row.youtube_title?.trim()
    || truncateSlack(row.post_text, 80)
    || row.id
}

function asSocialPlatforms(values: unknown[]): SocialPlatform[] {
  const labels = new Set(['linkedin', 'youtube', 'instagram', 'facebook', 'tiktok', 'x'])
  return Array.from(new Set(values)).filter((value): value is SocialPlatform => (
    typeof value === 'string' && labels.has(value)
  ))
}

async function scheduledSocialContentRows(limit = 10) {
  if (!supabaseAdmin) throw new Error('Database not available')

  const now = new Date()
  const startsAt = new Date(now.getTime() - socialContentGateReminderLookbackHours() * 60 * 60 * 1000)
  const endsAt = new Date(now.getTime() + socialContentGateReminderWindowHours() * 60 * 60 * 1000)

  const { data, error } = await supabaseAdmin
    .from('social_content_queue')
    .select('id, topic_extracted, platform, target_platforms, status, scheduled_for, post_text, image_url, video_url, carousel_slide_urls, youtube_title, youtube_description, rag_context')
    .eq('status', 'scheduled')
    .gte('scheduled_for', startsAt.toISOString())
    .lte('scheduled_for', endsAt.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to read scheduled Social Content rows: ${error.message}`)
  const seenIds = new Set<string>()
  const uniqueRows = ((data ?? []) as ScheduledSocialContentRow[]).filter((row) => {
    if (seenIds.has(row.id)) return false
    seenIds.add(row.id)
    return true
  })

  return uniqueRows.sort((left, right) => {
    const leftTime = new Date(left.scheduled_for ?? '').getTime()
    const rightTime = new Date(right.scheduled_for ?? '').getTime()
    const leftOverdue = Number.isFinite(leftTime) && leftTime < now.getTime()
    const rightOverdue = Number.isFinite(rightTime) && rightTime < now.getTime()
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1
    return (Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER)
      - (Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER)
  }).slice(0, limit)
}

async function socialPublishRows(contentIds: string[]) {
  if (!supabaseAdmin || !contentIds.length) return [] as SocialPublishRow[]
  const { data, error } = await supabaseAdmin
    .from('social_content_publishes')
    .select('content_id, platform, status, platform_post_url')
    .in('content_id', contentIds)
  if (error) throw new Error(`Failed to read Social Content publish rows: ${error.message}`)
  return (data ?? []) as SocialPublishRow[]
}

async function socialPlatformConfigs() {
  if (!supabaseAdmin) return [] as SocialContentConfigRow[]
  const { data, error } = await supabaseAdmin
    .from('social_content_config')
    .select('platform, credentials, settings, is_active')
  if (error) throw new Error(`Failed to read Social Content platform config: ${error.message}`)
  return (data ?? []) as SocialContentConfigRow[]
}

function blockedPlatformDetails(input: {
  row: ScheduledSocialContentRow
  publishes: SocialPublishRow[]
  configs: SocialContentConfigRow[]
}) {
  const matchingPublishes = input.publishes.filter((publish) => publish.content_id === input.row.id)
  const pendingPublishes = input.publishes.filter((publish) => (
    publish.content_id === input.row.id && (publish.status === 'pending' || publish.status === 'failed')
  ))
  const targetPlatforms = asSocialPlatforms(
    pendingPublishes.length
      ? pendingPublishes.map((publish) => publish.platform)
      : [
        ...(Array.isArray(input.row.target_platforms) ? input.row.target_platforms : []),
        input.row.platform,
      ],
  )
  if (!targetPlatforms.length) return []

  const plan = buildPlatformOrchestrationPlan({
    item: input.row as never,
    targetPlatforms,
    publishRecords: matchingPublishes,
    platformConfigs: input.configs,
    copyApproved: true,
    draftHandoffReady: matchingPublishes.length > 0,
    finalSubmissionGateReady: isPlatformSubmissionGateApproved(input.row.rag_context, targetPlatforms),
  })

  const details: Array<SocialPublishAttentionDetail | null> = plan.platforms
    .map((platformPlan): SocialPublishAttentionDetail | null => {
      const blocker = platformPlan.stages.find((stage) => (
        stage.state === 'blocked' || stage.state === 'pending'
      ))
      const automaticStage = platformPlan.stages.find((stage) => stage.key === 'automatic_submission')
      if (!blocker && automaticStage?.state === 'available') return null
      if (!blocker) return null
      return {
        platform: platformPlan.platform,
        label: platformPlan.label,
        detail: blocker.detail,
        nextAction: platformPlan.nextAction,
        kind: 'orchestration_blocker' as const,
      }
    })

  return details.filter((detail): detail is SocialPublishAttentionDetail => detail !== null)
}

function staleScheduleAttentionDetail(input: {
  row: ScheduledSocialContentRow
  publishes: SocialPublishRow[]
  now: Date
}): SocialPublishAttentionDetail | null {
  const scheduledAt = new Date(input.row.scheduled_for ?? '').getTime()
  const staleBefore = input.now.getTime()
    - socialContentScheduledPublishStaleHours() * 60 * 60 * 1000
  if (!Number.isFinite(scheduledAt) || scheduledAt >= staleBefore) return null

  const pendingPlatforms = asSocialPlatforms(input.publishes
    .filter((publish) => (
      publish.content_id === input.row.id
      && (publish.status === 'pending' || publish.status === 'failed')
    ))
    .map((publish) => publish.platform))
  if (!pendingPlatforms.length) return null

  const platform = pendingPlatforms[0]
  return {
    platform,
    label: `Stale ${socialPlatformLabel(platform)} schedule`,
    detail: 'Scheduled time is outside the automatic publish safety window. Reschedule and reconfirm, or cancel, in Social Content. This reminder does not approve or publish the item.',
    nextAction: 'Review the canonical Social Content item, then reschedule and reconfirm or cancel it.',
    kind: 'stale_schedule',
  }
}

async function buildSocialPublishGateDuePayload() {
  const rows = await scheduledSocialContentRows()
  const publishes = await socialPublishRows(rows.map((row) => row.id))
  const configs = await socialPlatformConfigs()
  const now = new Date()
  const items = rows
    .map((row) => {
      const staleSchedule = staleScheduleAttentionDetail({ row, publishes, now })
      return {
        row,
        staleSchedule: Boolean(staleSchedule),
        blockedDetails: [
          ...(staleSchedule ? [staleSchedule] : []),
          ...blockedPlatformDetails({ row, publishes, configs }),
        ],
      }
    })
    .filter((item) => item.blockedDetails.length > 0)

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: mrkdwn([
        '*Scheduled Social Content needs human QA*',
        `These items are overdue within the ${socialContentGateReminderLookbackHours()}-hour safety lookback or scheduled within ${socialContentGateReminderWindowHours()} hours, but still have a publish blocker. Slack is only the reminder surface; approval stays in Portfolio.`,
      ].join('\n')),
    },
  ]

  if (!items.length) {
    blocks.push({ type: 'section', text: mrkdwn('No near-due scheduled Social Content rows are blocked by human QA or provider readiness.') })
    blocks.push({
      type: 'actions',
      elements: [slackButton({ label: 'Open Social Content', actionId: 'open_social_content', url: agentUrl('/admin/social-content') })],
    })
    return {
      text: 'No overdue or near-due Social Content publish gates need human QA.',
      blocks,
      itemCount: 0,
    }
  }

  for (const item of items.slice(0, 5)) {
    const details = item.blockedDetails
      .slice(0, 3)
      .map((detail) => `• *${detail.label}:* ${truncateSlack(detail.detail, 180)}`)
      .join('\n')
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(socialContentTitle(item.row), 120)}*`,
        `Scheduled: \`${formatScheduledFor(item.row.scheduled_for)}\``,
        details,
      ].join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: [
        slackButton({
          label: item.staleSchedule ? 'Review recovery' : 'Review gate',
          actionId: item.staleSchedule
            ? 'open_social_content_stale_schedule_recovery'
            : 'open_social_content_submission_gate',
          url: agentUrl(item.staleSchedule
            ? socialContentGateDeepLink(item.row.id, 'status')
            : socialContentGateDeepLink(item.row.id, 'submit')),
          style: 'primary',
        }),
        slackButton({
          label: 'Open queue',
          actionId: 'open_social_content_queue',
          url: agentUrl('/admin/social-content'),
        }),
      ],
    })
  }

  return {
    text: `${items.length} overdue or near-due Social Content item(s) need human QA before scheduled publishing.`,
    blocks,
    itemCount: items.length,
  }
}

async function buildSocialCalendarApprovalDuePayload() {
  const items = await socialCalendarApprovalRows()
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: mrkdwn([
        '*Content calendar approvals are due*',
        `These unreleased calendar rows are stale or scheduled within ${socialCalendarApprovalReminderWindowHours()} hours with an outstanding approval gate. Slack can record internal draft-handoff decisions; Portfolio remains the canonical readiness surface.`,
      ].join('\n')),
    },
  ]

  if (!items.length) {
    blocks.push({ type: 'section', text: mrkdwn('No unreleased calendar approvals are stale or due soon.') })
    blocks.push({
      type: 'actions',
      elements: [slackButton({ label: 'Open calendar', actionId: 'open_content_calendar', url: agentUrl('/admin/agents/content-intelligence?section=calendar') })],
    })
    return {
      text: 'No Content Intelligence calendar approvals are due soon.',
      blocks,
      itemCount: 0,
      dedupeKey: 'social_calendar_approval_due:none',
    }
  }

  for (const item of items.slice(0, 5)) {
    const gate = calendarApprovalGateSummary(item.row)
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(item.row.title, 120)}*`,
        `Channel: \`${CALENDAR_CHANNEL_LABELS[item.row.channel]}\` - Release: \`${formatScheduledFor(item.row.scheduled_for)}\` - Window: \`${item.window}\``,
        `Gate: *${gate.label}* - Owner: \`${gate.owner}\``,
        `Action: ${truncateSlack(gate.action, 180)}`,
        gate.manualOnly ? 'Provider/manual path is visible and fail-closed.' : null,
        item.stale ? 'Release window elapsed before approval. Review recalibration in Content Intelligence.' : null,
      ].filter(Boolean).join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: [
        ...(!item.stale ? [
          slackButton({
            label: 'Authorize handoff',
            actionId: 'social_calendar_draft_handoff_approve',
            style: 'primary',
            value: {
              action: 'social_calendar_draft_handoff.approve',
              schemaVersion: 'social-calendar-approval/v1',
              calendarItemId: item.row.id,
              contentId: item.row.social_content_queue?.id ?? item.row.social_content_id ?? undefined,
              note: 'Authorize Draft Handoff tapped in Slack. Record internal content-readiness approval only; do not publish, schedule externally, upload, or call providers.',
            },
            confirmText: 'Authorize the internal draft handoff for this calendar item? This will not publish, schedule externally, upload, or call providers.',
          }),
          slackButton({
            label: 'Reject',
            actionId: 'social_calendar_draft_handoff_reject',
            value: {
              action: 'social_calendar_draft_handoff.reject',
              schemaVersion: 'social-calendar-approval/v1',
              calendarItemId: item.row.id,
              contentId: item.row.social_content_queue?.id ?? item.row.social_content_id ?? undefined,
              note: 'Rejected from Slack. Keep content pipeline blocked until the calendar item is revised.',
            },
          }),
        ] : []),
        slackButton({
          label: item.stale ? 'Review recovery' : 'Open gate',
          actionId: item.stale ? 'open_social_calendar_recalibration' : 'open_social_calendar_approval_gate',
          url: agentUrl(socialCalendarApprovalDeepLink(item.row)),
          style: item.stale ? 'primary' : undefined,
        }),
        slackButton({
          label: 'Open calendar',
          actionId: 'open_content_calendar',
          url: agentUrl('/admin/agents/content-intelligence?section=calendar'),
        }),
      ],
    })
  }

  return {
    text: `${items.length} Content Intelligence calendar approval(s) are stale or due soon.`,
    blocks,
    itemCount: items.length,
    dedupeKey: socialCalendarApprovalDedupeKey(items),
  }
}

function socialPlatformLabel(platform: string | null | undefined) {
  const labels: Record<string, string> = {
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X',
  }
  return labels[String(platform ?? '').toLowerCase()] ?? (platform || 'Unknown platform')
}

function commentPolicyLine(row: SocialCommentAttentionRow) {
  if (canSlackDecideCommentReply(row)) {
    return 'Slack can approve or reject this prepared low-risk reply. Approval starts a 15-minute hold; Portfolio remains canonical.'
  }
  if (!(row.proposed_reply_text?.trim() || row.approved_reply_text?.trim())) return 'No prepared reply draft yet. Review in Portfolio.'
  return 'Portfolio review required before this reply can move forward.'
}

async function buildSocialCommentAttentionPayload() {
  const read = await listSocialCommentAttentionRows()
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: mrkdwn([
        '*Social comments need attention*',
        'Slack is the alert and lightweight approval surface. Portfolio remains the canonical review queue.',
      ].join('\n')),
    },
  ]

  if (!read.dataSurfaceReady) {
    blocks.push({
      type: 'section',
      text: mrkdwn(read.reason ?? 'Comment inbox data is not available yet. Provider ingestion remains manual.'),
    })
    blocks.push({
      type: 'actions',
      elements: [slackButton({ label: 'Open Social Content', actionId: 'open_social_content', url: agentUrl('/admin/social-content') })],
    })
    return {
      text: 'Social comment attention sweep is waiting on the comment inbox data surface.',
      blocks,
      itemCount: 0,
    }
  }

  if (!read.rows.length) {
    blocks.push({ type: 'section', text: mrkdwn('No unresolved high-priority Social Content comments need Slack attention.') })
    blocks.push({
      type: 'actions',
      elements: [slackButton({ label: 'Open Social Content', actionId: 'open_social_content', url: agentUrl('/admin/social-content') })],
    })
    return {
      text: 'No Social Content comments need Slack attention.',
      blocks,
      itemCount: 0,
    }
  }

  for (const row of read.rows.slice(0, 5)) {
    const canDecide = canSlackDecideCommentReply(row)
    const comment = truncateSlack(row.body, 220)
    const draft = truncateSlack(row.approved_reply_text || row.proposed_reply_text, 180)
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(socialCommentPostTitle(row), 120)}*`,
        `Platform: \`${socialPlatformLabel(row.platform)}\` - Classification: \`${row.classification_status || 'unreviewed'}\` - Priority: \`${row.priority || 'normal'}\``,
        row.author_display_name ? `From: ${truncateSlack(row.author_display_name, 80)}` : null,
        comment ? `Comment: ${comment}` : null,
        `Draft state: \`${socialCommentDraftState(row)}\``,
        draft ? `Draft: ${draft}` : null,
        commentPolicyLine(row),
      ].filter(Boolean).join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: canDecide
        ? [
            slackButton({
              label: 'Approve reply',
              actionId: 'social_comment_reply_approve',
              style: 'primary',
              value: {
                action: 'social_comment_reply.approve',
                commentId: row.id,
                contentId: row.content_id ?? undefined,
                note: 'Approved from Slack. Start the 15-minute hold before any provider-send eligibility check.',
              },
              confirmText: 'Approve this prepared low-risk reply? It will be held for 15 minutes and will not be sent by Slack.',
            }),
            slackButton({
              label: 'Reject reply',
              actionId: 'social_comment_reply_reject',
              style: 'danger',
              value: {
                action: 'social_comment_reply.reject',
                commentId: row.id,
                contentId: row.content_id ?? undefined,
                note: 'Rejected from Slack.',
              },
            }),
            slackButton({
              label: 'Open gate',
              actionId: 'open_social_comment_review',
              url: agentUrl(socialCommentDeepLink(row)),
            }),
          ]
        : [
            slackButton({
              label: 'Open gate',
              actionId: 'open_social_comment_review',
              url: agentUrl(socialCommentDeepLink(row)),
              style: 'primary',
            }),
          ],
    })
  }

  return {
    text: `${read.rows.length} Social Content comment(s) need attention.`,
    blocks,
    itemCount: read.rows.length,
  }
}

function workItemBlocks(title: string, intro: string, items: AgentWorkItem[], kind: AgentSlackNotificationKind) {
  const blocks: SlackBlock[] = [
    { type: 'section', text: mrkdwn(`*${title}*\n${intro}`) },
  ]
  if (!items.length) {
    blocks.push({ type: 'section', text: mrkdwn('No matching Agent Ops work items need mobile attention.') })
    blocks.push({
      type: 'actions',
      elements: [slackButton({ label: 'Open Mission Control', actionId: 'open_mission_control', url: agentUrl('/admin/agents') })],
    })
    return blocks
  }
  for (const item of items.slice(0, 5)) {
    blocks.push({ type: 'section', text: mrkdwn(itemSummary(item)) })
    blocks.push({
      type: 'actions',
      elements: [
        workItemPrimaryButton(item, kind),
        workItemContextButton(item),
      ],
    })
  }
  blocks.push({
    type: 'actions',
    elements: [slackButton({ label: 'Open Kanban', actionId: 'open_kanban', url: agentUrl('/admin/agents/swarm-board') })],
  })
  return blocks
}

function selectedAgentQuestionBlocks(input: AgentSlackNotificationInput, items: AgentWorkItem[]) {
  const targetAgentKeys = normalizeTargetAgentKeys(input.targetAgentKeys)
  const selectedAgentText = targetAgentKeys.length
    ? targetAgentKeys.map((key) => `• ${agentDisplayName(key)} (\`${key}\`)`).join('\n')
    : '• No specific agents selected. Shaka can route this from the thread.'
  const question = truncateSlack(input.message?.trim() || 'No question provided.', 900)
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: mrkdwn([
        '*Standup question for selected agents*',
        `*Question:* ${question}`,
        '*Participants:*',
        selectedAgentText,
      ].join('\n')),
    },
    {
      type: 'context',
      elements: [
        mrkdwn('Reply in this thread to continue with Shaka. Use `acknowledge`, `ready`, `request revision`, `assign <agent>`, or `handoff to <agent>` when the thread includes one clear work card.'),
      ],
    },
  ]

  if (items.length) {
    blocks.push({ type: 'divider' })
    blocks.push({ type: 'section', text: mrkdwn('*Current work context*') })
    for (const item of items.slice(0, 5)) {
      blocks.push({ type: 'section', text: mrkdwn(itemSummary(item)) })
      blocks.push({
        type: 'actions',
        elements: [
          workItemPrimaryButton(item, 'selected_agent_question'),
          workItemContextButton(item),
        ],
      })
    }
  } else {
    blocks.push({
      type: 'section',
      text: mrkdwn('No active Kanban cards are currently assigned to the selected agents. The question is still posted as a standup thread so Shaka can capture the mobile follow-up.'),
    })
  }

  blocks.push({
    type: 'actions',
    elements: [
      slackButton({ label: 'Open Standup Room', actionId: 'open_standup_room', url: agentUrl('/admin/agents/standup') }),
      slackButton({ label: 'Open Kanban', actionId: 'open_kanban', url: agentUrl('/admin/agents/swarm-board') }),
    ],
  })

  return blocks
}

async function buildPendingApprovalPayload() {
  const approvals = await pendingApprovals()
  const runs = await runsById(approvals.map((approval) => approval.run_id))
  const blocks: SlackBlock[] = [
    { type: 'section', text: mrkdwn('*Pending Agent Ops approvals*\nUse Slack for low-risk decisions. High-risk packets stay in Portfolio.') },
  ]
  if (!approvals.length) {
    blocks.push({ type: 'section', text: mrkdwn('No pending approvals need mobile action.') })
  }
  for (const approval of approvals) {
    const run = runs.get(approval.run_id)
    const canDecideInSlack = approval.approval_type === 'vercel_deployment_research_proposal'
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(run?.title ?? approval.run_id, 120)}*`,
        `Type: \`${approval.approval_type}\` - Status: \`${approval.status}\``,
        run?.current_step ? `Step: ${truncateSlack(run.current_step, 140)}` : null,
        canDecideInSlack
          ? 'Primary action: approve only after the trace evidence matches the packet.'
          : 'Primary action: open Portfolio because this approval crosses a protected boundary.',
      ].filter(Boolean).join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: [
        canDecideInSlack
          ? slackButton({
              label: 'Approve',
              actionId: 'agent_approval_approve',
              style: 'primary',
              value: { action: 'approval.approve', approvalId: approval.id, runId: approval.run_id },
              confirmText: `Approve ${run?.title ?? approval.run_id}?`,
            })
          : slackButton({
              label: 'Open gate',
              actionId: 'open_decision',
              url: agentUrl(`/admin/agents/coordination?approvalRunId=${approval.run_id}#vercel-autoresearch-approval-gate`),
            }),
        slackButton({
          label: 'Ask Shaka',
          actionId: 'agent_approval_ask_shaka',
          value: { action: 'approval.ask_shaka', approvalId: approval.id, runId: approval.run_id },
        }),
      ],
    })
  }
  return {
    text: `${approvals.length} pending Agent Ops approval(s) need review.`,
    blocks,
    itemCount: approvals.length,
  }
}

async function staleRuns(limit = 5) {
  if (!supabaseAdmin) throw new Error('Database not available')
  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .select('id, title, runtime, status, current_step, error_message, started_at')
    .in('status', ['failed', 'stale'])
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Failed to read stale runs: ${error.message}`)
  return (data ?? []) as AgentRunSummaryRow[]
}

async function buildStaleRunsPayload() {
  const runs = await staleRuns()
  const blocks: SlackBlock[] = [
    { type: 'section', text: mrkdwn('*Stale or failed Agent Ops runs*\nUse this when a trace needs mobile recovery triage. Slack can summarize the next step; recovery mutations stay in Portfolio.') },
  ]
  if (!runs.length) {
    blocks.push({ type: 'section', text: mrkdwn('No stale or failed runs need mobile action.') })
    blocks.push({
      type: 'actions',
      elements: [slackButton({ label: 'Open Run Console', actionId: 'open_run_console', url: agentUrl('/admin/agents/runs') })],
    })
  }
  for (const run of runs) {
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(run.title ?? run.id, 120)}*`,
        `Status: \`${run.status ?? 'unknown'}\` - Runtime: \`${run.runtime ?? 'unknown'}\``,
        run.current_step ? `Step: ${truncateSlack(run.current_step, 140)}` : null,
        run.error_message ? `Problem: ${truncateSlack(run.error_message, 160)}` : null,
      ].filter(Boolean).join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: [
        slackButton({
          label: 'Ask Shaka',
          actionId: 'agent_run_ask_shaka',
          value: { action: 'run.ask_shaka', runId: run.id },
        }),
        slackButton({ label: 'Open trace', actionId: 'open_trace', url: agentUrl(`/admin/agents/runs/${run.id}`) }),
      ],
    })
  }
  return {
    text: `${runs.length} stale or failed Agent Ops run(s) need mobile triage.`,
    blocks,
    itemCount: runs.length,
  }
}

async function buildHighSignalInsightsPayload() {
  const snapshot = await buildAgentMissionControlSnapshot()
  const insights = snapshot.high_signal_ai_insights ?? []
  return {
    text: highSignalInsightsSlackText(insights),
    blocks: highSignalInsightsSlackBlocks({ insights, baseUrl: baseUrl() }),
    itemCount: insights.length,
  }
}

async function buildWorkItemPayload(input: AgentSlackNotificationInput) {
  const targetAgentKeys = normalizeTargetAgentKeys(input.targetAgentKeys)
  const allItems = await listAgentWorkItems({ limit: 75 })
  let items: AgentWorkItem[] = []
  let title = 'Agent Ops mobile unblock'
  let intro = 'Review the items that need a quick mobile decision.'

  if (input.kind === 'blockers' || input.kind === 'standup_blockers') {
    items = allItems.filter((item) => item.status === 'blocked' || Boolean(item.blocker_summary))
    title = input.kind === 'standup_blockers' ? "Today's standup blockers" : 'Agent Ops blockers'
    intro = 'Start here when work is stuck or waiting on an owner decision.'
  } else if (input.kind === 'review_ready') {
    items = allItems.filter((item) => item.status === 'ready_for_review' || item.status === 'ready_for_merge')
    title = 'Review-ready Agent Ops work'
    intro = 'These cards are waiting for review, trace inspection, or merge readiness.'
  } else if (input.kind === 'goal_decisions') {
    items = allItems.filter((item) => {
      const metadata = item.metadata ?? {}
      const goalId = typeof metadata.goal_id === 'string' ? metadata.goal_id : null
      const needsDecision = Boolean(item.blocker_summary) ||
        item.status === 'blocked' ||
        item.status === 'proposed' ||
        metadata.requires_approval === true
      return Boolean(goalId) && (!input.goalId || goalId === input.goalId) && needsDecision
    })
    title = 'Goal tasks needing a decision'
    intro = 'These goal-tagged tasks need an owner, unblock decision, or Shaka follow-up.'
  } else if (input.kind === 'selected_agent_question') {
    title = 'Standup question for selected agents'
    intro = input.message?.trim() || 'Selected agents need a quick mobile standup response.'
    items = filterTargetAgents(allItems, targetAgentKeys)
      .filter((item) => !['merged', 'deployed', 'cancelled'].includes(item.status))
  }

  items = filterTargetAgents(items, targetAgentKeys).sort(prioritySort).slice(0, 5)
  if (input.kind === 'selected_agent_question') {
    return {
      text: `${title}: ${targetAgentKeys.length || 'all'} agent(s) asked.`,
      blocks: selectedAgentQuestionBlocks(input, items),
      itemCount: items.length,
    }
  }

  return {
    text: `${title}: ${items.length} item(s).`,
    blocks: workItemBlocks(title, intro, items, input.kind),
    itemCount: items.length,
  }
}

export async function buildAgentSlackNotificationPayload(input: AgentSlackNotificationInput) {
  if (input.kind === 'pending_approvals') return buildPendingApprovalPayload()
  if (input.kind === 'stale_runs') return buildStaleRunsPayload()
  if (input.kind === 'high_signal_insights') return buildHighSignalInsightsPayload()
  if (input.kind === 'social_calendar_approval_due') return buildSocialCalendarApprovalDuePayload()
  if (input.kind === 'social_publish_gate_due') return buildSocialPublishGateDuePayload()
  if (input.kind === 'social_comment_attention_due') return buildSocialCommentAttentionPayload()
  return buildWorkItemPayload(input)
}

async function postWithBotToken(text: string, blocks: SlackBlock[]): Promise<SlackDeliveryResult | null> {
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_AGENT_OPS_CHANNEL_ID || process.env.SLACK_AGENT_OPS_CHANNEL
  if (!token || !channel) return null

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      text,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    }),
  })
  const body = await response.json().catch(() => null) as { ok?: boolean; error?: string; channel?: string; ts?: string } | null
  if (!response.ok || body?.ok === false) {
    return {
      sent: false,
      reason: `Slack bot delivery returned ${body?.error ?? `HTTP ${response.status}`}.`,
      mode: 'bot',
      channel,
      ts: null,
    }
  }
  return {
    sent: true,
    reason: null,
    mode: 'bot',
    channel: body?.channel ?? channel,
    ts: body?.ts ?? null,
  }
}

async function postWithWebhook(text: string, blocks: SlackBlock[]): Promise<SlackDeliveryResult> {
  const webhookUrl = process.env.SLACK_AGENT_OPS_WEBHOOK_URL
  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    return { sent: false, reason: 'Slack bot channel and webhook are not configured.', mode: 'none' }
  }
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, blocks }),
  })
  if (!response.ok) {
    return { sent: false, reason: `Slack webhook returned HTTP ${response.status}.`, mode: 'webhook' }
  }
  return { sent: true, reason: null, mode: 'webhook' }
}

async function postToSlack(text: string, blocks: SlackBlock[]): Promise<SlackDeliveryResult> {
  const botDelivery = await postWithBotToken(text, blocks)
  if (botDelivery?.sent) return botDelivery

  const webhookDelivery = await postWithWebhook(text, blocks)
  if (webhookDelivery.sent || !botDelivery) return webhookDelivery

  return {
    ...botDelivery,
    reason: `${botDelivery.reason} Webhook fallback also failed: ${webhookDelivery.reason}`,
  }
}

export async function sendAgentSlackNotification(input: AgentSlackNotificationInput): Promise<AgentSlackNotificationResult> {
  const idempotencyKey = notificationIdempotencyKey(input)
  const existing = input.force ? null : await existingNotificationRun(idempotencyKey)
  if (existing?.id) {
    return {
      ok: true,
      runId: existing.id,
      sent: false,
      skipped: true,
      deduped: true,
      reason: 'A matching Slack mobile notification was already prepared in this hourly window.',
      itemCount: Number(existing.metadata?.item_count ?? 0),
      text: String(existing.metadata?.text ?? 'Agent Ops Slack notification already prepared.'),
    }
  }

  const payload = await buildAgentSlackNotificationPayload(input)
  const run = await startAgentRun({
    agentKey: 'chief-of-staff',
    runtime: 'manual',
    kind: 'slack_mobile_notification',
    title: `Send Slack mobile notification: ${input.kind.replace(/_/g, ' ')}`,
    status: 'running',
    triggerSource: input.triggerSource ?? 'admin_agent_slack_mobile_bridge',
    currentStep: 'Preparing Slack payload',
    metadata: {
      notification_kind: input.kind,
      target_agent_keys: normalizeTargetAgentKeys(input.targetAgentKeys),
      goal_id: input.goalId ?? null,
      actor_label: input.actorLabel ?? null,
      notification_dedupe_key: input.dedupeKey ?? null,
      dedupe_window_hours: input.dedupeWindowHours ?? 1,
      item_count: payload.itemCount,
      text: payload.text,
    },
    idempotencyKey,
  })

  const delivery = await postToSlack(payload.text, payload.blocks)
  await recordAgentEvent({
    runId: run.id,
    eventType: delivery.sent ? 'slack_mobile_notification_sent' : 'slack_mobile_notification_skipped',
    severity: delivery.sent ? 'info' : 'warning',
    message: delivery.sent ? payload.text : delivery.reason,
    metadata: {
      notification_kind: input.kind,
      item_count: payload.itemCount,
      reason: delivery.reason,
      delivery_mode: delivery.mode,
      slack_channel: delivery.channel ?? null,
      slack_message_ts: delivery.ts ?? null,
      slack_thread_ts: delivery.ts ?? null,
      blocks: payload.blocks,
    },
    idempotencyKey: `${idempotencyKey}:delivery`,
  })
  await endAgentRun({
    runId: run.id,
    status: delivery.sent ? 'completed' : 'cancelled',
    currentStep: delivery.sent ? 'Slack notification sent' : 'Slack notification skipped',
    outcome: {
      sent: delivery.sent,
      skipped: !delivery.sent,
      reason: delivery.reason,
      item_count: payload.itemCount,
      delivery_mode: delivery.mode,
      slack_channel: delivery.channel ?? null,
      slack_message_ts: delivery.ts ?? null,
      slack_thread_ts: delivery.ts ?? null,
    },
  })

  return {
    ok: true,
    runId: run.id,
    sent: delivery.sent,
    skipped: !delivery.sent,
    deduped: false,
    reason: delivery.reason ?? undefined,
    itemCount: payload.itemCount,
    text: payload.text,
  }
}
