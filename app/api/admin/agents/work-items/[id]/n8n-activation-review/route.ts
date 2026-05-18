import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { requestAgentWorkItemN8nActivationReview } from '@/lib/agent-work-items'

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
    review_summary?: unknown
  }
  const reviewSummary = typeof body.review_summary === 'string' ? body.review_summary.trim() : ''
  if (!reviewSummary) {
    return NextResponse.json({ error: 'review_summary is required' }, { status: 400 })
  }

  try {
    const work_item = await requestAgentWorkItemN8nActivationReview({
      id: params.id,
      reviewSummary,
      actorLabel: auth.user.email,
    })
    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to request n8n activation review'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item-n8n-activation-review] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
