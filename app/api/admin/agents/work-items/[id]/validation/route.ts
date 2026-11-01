import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, recordAgentWorkItemValidation } from '@/lib/agent-work-items'

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
    validation_summary?: unknown
    ready_for_merge?: unknown
  }
  const validationSummary = typeof body.validation_summary === 'string' ? body.validation_summary.trim() : ''
  if (!validationSummary) {
    return NextResponse.json({ error: 'validation_summary is required' }, { status: 400 })
  }

  try {
    const current = await getAgentWorkItem(params.id)
    if (current?.source_type === 'social_content_linkedin_draft_handoff'
      && (current.metadata?.draft_packet as Record<string, unknown> | undefined)?.version === 'linkedin_draft_handoff_v2') {
      return NextResponse.json({ error: 'Use the immutable LinkedIn handoff review control.' }, { status: 409 })
    }
    const work_item = await recordAgentWorkItemValidation({
      id: params.id,
      validationSummary,
      readyForMerge: body.ready_for_merge === true,
    })
    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record validation'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item-validation] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
