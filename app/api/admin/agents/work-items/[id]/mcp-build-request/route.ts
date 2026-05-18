import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { requestAgentWorkItemMcpBuild } from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as {
    request_summary?: unknown
  }
  const requestSummary = typeof body.request_summary === 'string' ? body.request_summary.trim() : ''
  if (!requestSummary) {
    return NextResponse.json({ error: 'request_summary is required' }, { status: 400 })
  }

  try {
    const work_item = await requestAgentWorkItemMcpBuild({
      id: params.id,
      requestSummary,
      actorLabel: auth.user.email,
    })
    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to request MCP build'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item-mcp-build-request] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
