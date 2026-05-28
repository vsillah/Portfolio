import { createHash } from 'crypto'
import {
  buildAgentSlackNotificationPayload,
  sendAgentSlackNotification,
  type AgentSlackNotificationKind,
  type AgentSlackNotificationResult,
} from '@/lib/agent-slack-notifications'

export type ProactiveSlackNotificationKind = Extract<
  AgentSlackNotificationKind,
  'pending_approvals' | 'blockers' | 'stale_runs' | 'review_ready' | 'goal_decisions'
>

export type ProactiveSlackNotificationMode = 'scheduled' | 'immediate' | 'all'

export type ProactiveSlackNotificationRule = {
  kind: ProactiveSlackNotificationKind
  label: string
  description: string
  triggerModes: Exclude<ProactiveSlackNotificationMode, 'all'>[]
  priority: 'normal' | 'high' | 'urgent'
  minimumItemCount: number
  dedupeWindowHours: number
}

export type AgentSlackNotificationSweepInput = {
  kinds?: ProactiveSlackNotificationKind[]
  mode?: ProactiveSlackNotificationMode
  dryRun?: boolean
  force?: boolean
  actorLabel?: string | null
  triggerSource?: string | null
}

export type AgentSlackNotificationSweepRuleResult = {
  kind: ProactiveSlackNotificationKind
  label: string
  itemCount: number
  sent: boolean
  skipped: boolean
  deduped: boolean
  dryRun: boolean
  mode: ProactiveSlackNotificationMode
  priority: ProactiveSlackNotificationRule['priority']
  triggerModes: ProactiveSlackNotificationRule['triggerModes']
  runId?: string
  text: string
  reason?: string
  error?: string
}

export const PROACTIVE_SLACK_NOTIFICATION_RULES: ProactiveSlackNotificationRule[] = [
  {
    kind: 'pending_approvals',
    label: 'Pending approvals',
    description: 'Human approval packets that can be reviewed from mobile or opened in Portfolio.',
    triggerModes: ['immediate', 'scheduled'],
    priority: 'urgent',
    minimumItemCount: 1,
    dedupeWindowHours: 1,
  },
  {
    kind: 'blockers',
    label: 'Blocked work',
    description: 'Blocked Kanban work that needs acknowledgement, owner assignment, or Shaka guidance. Routine blocker packets stay in the scheduled sweep; urgent blockers should be sent from Mission Control or Standup Room with context.',
    triggerModes: ['scheduled'],
    priority: 'high',
    minimumItemCount: 1,
    dedupeWindowHours: 4,
  },
  {
    kind: 'stale_runs',
    label: 'Stale or failed runs',
    description: 'Failed or stale traces that need recovery triage.',
    triggerModes: ['scheduled'],
    priority: 'high',
    minimumItemCount: 1,
    dedupeWindowHours: 4,
  },
  {
    kind: 'review_ready',
    label: 'Review-ready work',
    description: 'Cards waiting for review, revision request, or trace inspection.',
    triggerModes: ['scheduled'],
    priority: 'normal',
    minimumItemCount: 1,
    dedupeWindowHours: 4,
  },
  {
    kind: 'goal_decisions',
    label: 'Goal decisions',
    description: 'Goal-tagged tasks waiting on a human decision.',
    triggerModes: ['immediate', 'scheduled'],
    priority: 'urgent',
    minimumItemCount: 1,
    dedupeWindowHours: 4,
  },
]

function selectedRules(kinds?: ProactiveSlackNotificationKind[], mode: ProactiveSlackNotificationMode = 'scheduled') {
  const modeFilteredRules = mode === 'all'
    ? PROACTIVE_SLACK_NOTIFICATION_RULES
    : PROACTIVE_SLACK_NOTIFICATION_RULES.filter((rule) => rule.triggerModes.includes(mode))
  if (!kinds?.length) return modeFilteredRules
  const allowed = new Set(kinds)
  return modeFilteredRules.filter((rule) => allowed.has(rule.kind))
}

function payloadDedupeKey(kind: ProactiveSlackNotificationKind, payload: Awaited<ReturnType<typeof buildAgentSlackNotificationPayload>>) {
  const fingerprint = createHash('sha256')
    .update(payload.text)
    .update(JSON.stringify(payload.blocks))
    .digest('hex')
    .slice(0, 16)
  return `${kind}:${payload.itemCount}:${fingerprint}`
}

function sweepResultFromNotification(
  rule: ProactiveSlackNotificationRule,
  notification: AgentSlackNotificationResult,
  mode: ProactiveSlackNotificationMode,
): AgentSlackNotificationSweepRuleResult {
  return {
    kind: rule.kind,
    label: rule.label,
    itemCount: notification.itemCount,
    sent: notification.sent,
    skipped: notification.skipped,
    deduped: notification.deduped,
    dryRun: false,
    mode,
    priority: rule.priority,
    triggerModes: rule.triggerModes,
    runId: notification.runId,
    text: notification.text,
    reason: notification.reason,
  }
}

export async function runAgentSlackNotificationSweep(input: AgentSlackNotificationSweepInput = {}) {
  const results: AgentSlackNotificationSweepRuleResult[] = []
  const mode = input.mode ?? 'scheduled'

  for (const rule of selectedRules(input.kinds, mode)) {
    try {
      const payload = await buildAgentSlackNotificationPayload({ kind: rule.kind })

      if (payload.itemCount < rule.minimumItemCount) {
        results.push({
          kind: rule.kind,
          label: rule.label,
          itemCount: payload.itemCount,
          sent: false,
          skipped: true,
          deduped: false,
          dryRun: Boolean(input.dryRun),
          mode,
          priority: rule.priority,
          triggerModes: rule.triggerModes,
          text: payload.text,
          reason: 'No matching Agent Ops work needs mobile attention.',
        })
        continue
      }

      const dedupeKey = payloadDedupeKey(rule.kind, payload)
      if (input.dryRun) {
        results.push({
          kind: rule.kind,
          label: rule.label,
          itemCount: payload.itemCount,
          sent: false,
          skipped: true,
          deduped: false,
          dryRun: true,
          mode,
          priority: rule.priority,
          triggerModes: rule.triggerModes,
          text: payload.text,
          reason: 'Dry run only.',
        })
        continue
      }

      const notification = await sendAgentSlackNotification({
        kind: rule.kind,
        force: input.force,
        actorLabel: input.actorLabel ?? 'Agent Ops notification sweep',
        triggerSource: input.triggerSource ?? 'cron_agent_ops_slack_notifications',
        dedupeKey,
        dedupeWindowHours: rule.dedupeWindowHours,
      })
      results.push(sweepResultFromNotification(rule, notification, mode))
    } catch (error) {
      results.push({
        kind: rule.kind,
        label: rule.label,
        itemCount: 0,
        sent: false,
        skipped: false,
        deduped: false,
        dryRun: Boolean(input.dryRun),
        mode,
        priority: rule.priority,
        triggerModes: rule.triggerModes,
        text: `${rule.label} failed.`,
        error: error instanceof Error ? error.message : 'Unknown Slack notification sweep error',
      })
    }
  }

  const sentCount = results.filter((result) => result.sent).length
  const dedupedCount = results.filter((result) => result.deduped).length
  const skippedCount = results.filter((result) => result.skipped).length
  const errorCount = results.filter((result) => result.error).length

  return {
    ok: errorCount === 0,
    dryRun: Boolean(input.dryRun),
    mode,
    totalRules: results.length,
    sentCount,
    dedupedCount,
    skippedCount,
    errorCount,
    itemCount: results.reduce((sum, result) => sum + result.itemCount, 0),
    results,
  }
}
