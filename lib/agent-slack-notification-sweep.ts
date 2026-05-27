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

export type ProactiveSlackNotificationRule = {
  kind: ProactiveSlackNotificationKind
  label: string
  description: string
  minimumItemCount: number
  dedupeWindowHours: number
}

export type AgentSlackNotificationSweepInput = {
  kinds?: ProactiveSlackNotificationKind[]
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
    minimumItemCount: 1,
    dedupeWindowHours: 1,
  },
  {
    kind: 'blockers',
    label: 'Blocked work',
    description: 'Blocked Kanban work that needs acknowledgement, owner assignment, or Shaka guidance.',
    minimumItemCount: 1,
    dedupeWindowHours: 4,
  },
  {
    kind: 'stale_runs',
    label: 'Stale or failed runs',
    description: 'Failed or stale traces that need recovery triage.',
    minimumItemCount: 1,
    dedupeWindowHours: 4,
  },
  {
    kind: 'review_ready',
    label: 'Review-ready work',
    description: 'Cards waiting for review, revision request, or trace inspection.',
    minimumItemCount: 1,
    dedupeWindowHours: 4,
  },
  {
    kind: 'goal_decisions',
    label: 'Goal decisions',
    description: 'Goal-tagged tasks waiting on a human decision.',
    minimumItemCount: 1,
    dedupeWindowHours: 4,
  },
]

function selectedRules(kinds?: ProactiveSlackNotificationKind[]) {
  if (!kinds?.length) return PROACTIVE_SLACK_NOTIFICATION_RULES
  const allowed = new Set(kinds)
  return PROACTIVE_SLACK_NOTIFICATION_RULES.filter((rule) => allowed.has(rule.kind))
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
): AgentSlackNotificationSweepRuleResult {
  return {
    kind: rule.kind,
    label: rule.label,
    itemCount: notification.itemCount,
    sent: notification.sent,
    skipped: notification.skipped,
    deduped: notification.deduped,
    dryRun: false,
    runId: notification.runId,
    text: notification.text,
    reason: notification.reason,
  }
}

export async function runAgentSlackNotificationSweep(input: AgentSlackNotificationSweepInput = {}) {
  const results: AgentSlackNotificationSweepRuleResult[] = []

  for (const rule of selectedRules(input.kinds)) {
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
      results.push(sweepResultFromNotification(rule, notification))
    } catch (error) {
      results.push({
        kind: rule.kind,
        label: rule.label,
        itemCount: 0,
        sent: false,
        skipped: false,
        deduped: false,
        dryRun: Boolean(input.dryRun),
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
    totalRules: results.length,
    sentCount,
    dedupedCount,
    skippedCount,
    errorCount,
    itemCount: results.reduce((sum, result) => sum + result.itemCount, 0),
    results,
  }
}
