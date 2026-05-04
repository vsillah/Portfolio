import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { routeAgentInboxItem } from '@/lib/agent-inbox-routing'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as {
    item_id?: unknown
  }

  const itemRef = typeof body.item_id === 'string' ? body.item_id.trim() : ''
  if (!itemRef) {
    return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
  }

  try {
    const result = await routeAgentInboxItem({
      itemRef,
      actor: {
        id: auth.user.id,
        label: 'Admin user',
        type: 'admin_user',
        userId: auth.user.id,
      },
      triggerSource: 'admin_agent_inbox_route',
    })

    return NextResponse.json({
      ok: true,
      run_id: result.runId,
      route_action: result.routeAction,
      status: result.status,
      execution_mode: result.executionMode,
      item: result.item,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to route Agent Inbox item'
    const status = message === 'Agent Inbox item not found' ? 404 : 500
    console.error('[admin-agent-inbox-route] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
