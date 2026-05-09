import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { attachAgentWorkItemPr } from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const prNumber = typeof body.pr_number === 'number' && Number.isFinite(body.pr_number)
    ? body.pr_number
    : null

  try {
    const work_item = await attachAgentWorkItemPr({
      id: params.id,
      prNumber,
      prUrl: typeof body.pr_url === 'string' ? body.pr_url : null,
      branchName: typeof body.branch_name === 'string' ? body.branch_name : null,
      touchedFiles: stringArray(body.touched_files),
    })
    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to attach PR'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item-pr] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
