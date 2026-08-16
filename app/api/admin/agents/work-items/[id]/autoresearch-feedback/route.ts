import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, updateAgentWorkItemMetadata } from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'

const FEEDBACK_TARGETS = ['current_backlog_item', 'next_autoresearch_pass', 'both'] as const

type FeedbackTarget = (typeof FEEDBACK_TARGETS)[number]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asFeedbackTarget(value: unknown): FeedbackTarget | null {
  return FEEDBACK_TARGETS.includes(value as FeedbackTarget) ? value as FeedbackTarget : null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = asRecord(await request.json().catch(() => ({})))
  const feedback = asString(body.feedback)
  const feedbackTarget = asFeedbackTarget(body.feedback_target)
  const backlogItemId = asString(body.backlog_item_id)
  const backlogItemTitle = asString(body.backlog_item_title)

  if (!feedback) {
    return NextResponse.json({ error: 'feedback is required' }, { status: 400 })
  }
  if (!feedbackTarget) {
    return NextResponse.json({ error: 'valid feedback_target is required' }, { status: 400 })
  }
  if (!backlogItemId) {
    return NextResponse.json({ error: 'backlog_item_id is required' }, { status: 400 })
  }

  try {
    const workItem = await getAgentWorkItem(params.id)
    if (!workItem) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    const metadata = workItem.metadata ?? {}
    const existingHandoffs = Array.isArray(metadata.autoresearch_feedback_handoffs)
      ? metadata.autoresearch_feedback_handoffs.map((item) => asRecord(item))
      : []
    const createdAt = new Date().toISOString()
    const handoff = {
      id: `autoresearch-feedback-${createdAt}-${backlogItemId}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
      created_at: createdAt,
      created_by: auth.user.email ?? auth.user.id,
      source: 'content_intelligence_autoresearch_card',
      backlog_item_id: backlogItemId,
      backlog_item_title: backlogItemTitle || null,
      feedback_target: feedbackTarget,
      feedback,
      current_gate: asString(body.current_gate) || null,
      release_link_id: asString(body.release_link_id) || null,
      release_title: asString(body.release_title) || null,
      release_scheduled_for: asString(body.release_scheduled_for) || null,
      status: 'recorded',
      side_effects: {
        provider_generation: false,
        provider_call: false,
        upload: false,
        schedule: false,
        publish: false,
        external_post: false,
        production_mutation: false,
      },
    }

    const updated = await updateAgentWorkItemMetadata({
      id: workItem.id,
      metadata: {
        ...metadata,
        autoresearch_feedback_handoffs: [
          ...existingHandoffs.slice(-9),
          handoff,
        ],
        autoresearch_feedback_latest: handoff,
      },
      note: `Recorded AutoResearch feedback for ${backlogItemTitle || backlogItemId}.`,
    })

    return NextResponse.json({
      ok: true,
      work_item: updated,
      feedback_handoff: handoff,
      side_effects: handoff.side_effects,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record AutoResearch feedback'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[autoresearch-feedback] record failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
