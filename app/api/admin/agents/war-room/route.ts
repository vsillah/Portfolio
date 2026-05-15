import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { runAgentWarRoom, type AgentWarRoomCommand } from '@/lib/agent-war-room'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function parseCommand(value: unknown): AgentWarRoomCommand | null {
  return value === 'standup' ||
    value === 'discuss' ||
    value === 'ask_agent' ||
    value === 'draft_goal' ||
    value === 'approve_goal'
    ? value
    : null
}

/**
 * POST /api/admin/agents/war-room
 *
 * Text-first war room for standups and agent discussions. V1 is read-only and
 * writes an observable trace plus transcript artifact through existing tables.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: {
    command?: unknown
    message?: unknown
    target_agent_key?: unknown
    targetAgentKey?: unknown
    goal_id?: unknown
    goalId?: unknown
    goal?: unknown
    draft?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const command = parseCommand(body.command)
  if (!command) {
    return NextResponse.json({ error: 'Invalid command' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if ((command === 'discuss' || command === 'ask_agent') && !message) {
    return NextResponse.json({ error: `Message is required for ${command}` }, { status: 400 })
  }

  const targetAgentKey = typeof body.target_agent_key === 'string'
    ? body.target_agent_key.trim()
    : typeof body.targetAgentKey === 'string'
      ? body.targetAgentKey.trim()
      : ''
  if (command === 'ask_agent' && !targetAgentKey) {
    return NextResponse.json({ error: 'target_agent_key is required for ask_agent' }, { status: 400 })
  }

  const goal = typeof body.goal === 'string' ? body.goal.trim() : ''
  const goalId = typeof body.goal_id === 'string'
    ? body.goal_id.trim()
    : typeof body.goalId === 'string'
      ? body.goalId.trim()
      : ''
  if (command === 'draft_goal' && !goal) {
    return NextResponse.json({ error: 'Goal is required for draft_goal' }, { status: 400 })
  }

  if (command === 'approve_goal' && (!body.draft || typeof body.draft !== 'object')) {
    return NextResponse.json({ error: 'draft is required for approve_goal' }, { status: 400 })
  }

  try {
    const result = await runAgentWarRoom({
      command,
      message,
      targetAgentKey,
      goalId,
      goal,
      draft: command === 'approve_goal' ? body.draft as never : null,
      triggerSource: 'admin_agent_war_room',
      actor: {
        id: auth.user.id,
        label: 'Admin War Room',
        type: 'admin_user',
      },
    })

    return NextResponse.json({
      ok: true,
      run_id: result.runId,
      command: result.command,
      updates: result.updates,
      synthesis: result.synthesis,
      messages: result.messages,
      goal_draft: result.goalDraft,
      created_work_items: result.createdWorkItems,
    })
  } catch (error) {
    console.error('[agent-war-room] command failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'War Room command failed' },
      { status: 500 },
    )
  }
}
