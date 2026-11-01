import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, markAgentWorkItemReadyForKanban } from '@/lib/agent-work-items'

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
    definition_of_ready?: unknown
  }
  const definitionOfReady = typeof body.definition_of_ready === 'string'
    ? body.definition_of_ready.trim()
    : ''
  if (!definitionOfReady) {
    return NextResponse.json({ error: 'definition_of_ready is required' }, { status: 400 })
  }

  try {
    const current = await getAgentWorkItem(params.id)
    if (current?.source_type === 'social_content_linkedin_draft_handoff'
      && (current.metadata?.draft_packet as Record<string, unknown> | undefined)?.version === 'linkedin_draft_handoff_v2') {
      return NextResponse.json({ error: 'Use the immutable LinkedIn handoff review control.' }, { status: 409 })
    }
    const work_item = await markAgentWorkItemReadyForKanban({
      id: params.id,
      definitionOfReady,
      actorLabel: ('email' in auth.user && typeof auth.user.email === 'string') ? auth.user.email : auth.user.id,
    })
    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark work item ready'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item-ready] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
