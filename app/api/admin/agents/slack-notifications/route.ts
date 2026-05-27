import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  sendAgentSlackNotification,
  type AgentSlackNotificationKind,
} from '@/lib/agent-slack-notifications'

export const dynamic = 'force-dynamic'

const VALID_KINDS = new Set<AgentSlackNotificationKind>([
  'pending_approvals',
  'blockers',
  'stale_runs',
  'review_ready',
  'goal_decisions',
  'standup_blockers',
  'selected_agent_question',
])

function parseKind(value: unknown): AgentSlackNotificationKind | null {
  return typeof value === 'string' && VALID_KINDS.has(value as AgentSlackNotificationKind)
    ? value as AgentSlackNotificationKind
    : null
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const kind = parseKind(body.kind)
  if (!kind) {
    return NextResponse.json({ error: 'Invalid Slack notification kind' }, { status: 400 })
  }

  if (kind === 'selected_agent_question' && typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message is required for selected_agent_question' }, { status: 400 })
  }

  try {
    const result = await sendAgentSlackNotification({
      kind,
      message: typeof body.message === 'string' ? body.message : '',
      targetAgentKeys: parseStringArray(body.target_agent_keys ?? body.targetAgentKeys),
      goalId: typeof body.goal_id === 'string'
        ? body.goal_id
        : typeof body.goalId === 'string'
          ? body.goalId
          : null,
      force: body.force === true,
      actorLabel: auth.user.email ?? auth.user.id,
      triggerSource: 'admin_agent_slack_notification',
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[agent-slack-notifications] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Slack notification failed' },
      { status: 500 },
    )
  }
}
