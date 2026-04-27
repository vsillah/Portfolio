import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { updateTask } from '@/lib/meeting-action-tasks'
import {
  generateOutreachDraftInApp,
  isInAppOutreachGenerationEnabled,
} from '@/lib/outreach-queue-generator'

export const dynamic = 'force-dynamic'

/**
 * POST /api/meeting-action-tasks/[id]/send-to-outreach
 *
 * Generates a draft email in `outreach_queue` for this task's attributed
 * contact and links the task to the resulting draft via `outreach_queue_id`.
 *
 * Idempotency:
 *   - If the task already has `outreach_queue_id` set, returns that draft
 *     (no duplicate generation, no OpenAI cost).
 *   - If a draft exists for this contact with `source_task_id = task.id`
 *     but is not yet linked on the task, links it and returns it.
 *
 * Requirements:
 *   - The task must have `contact_submission_id` set (orphan tasks must be
 *     attributed first via PATCH /api/meeting-action-tasks).
 *
 * Errors surfaced to the client are generic (per no-expose-errors rule).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    if (!isInAppOutreachGenerationEnabled()) {
      return NextResponse.json(
        { error: 'In-app outreach generation is disabled' },
        { status: 503 }
      )
    }

    const { id: taskId } = await params

    const { data: task, error: taskErr } = await supabaseAdmin
      .from('meeting_action_tasks')
      .select('id, title, contact_submission_id, outreach_queue_id, status')
      .eq('id', taskId)
      .maybeSingle()

    if (taskErr) {
      console.error('[send-to-outreach] Fetch task failed:', taskErr)
      return NextResponse.json(
        { error: 'Could not load task' },
        { status: 500 }
      )
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const contactId = task.contact_submission_id as number | null
    if (!contactId) {
      return NextResponse.json(
        {
          error:
            'Task is not attributed to a contact. Attribute it first (edit the task) before sending to outreach.',
        },
        { status: 400 }
      )
    }

    if (task.status === 'complete' || task.status === 'cancelled') {
      return NextResponse.json(
        { error: `Task is ${task.status}; reopen it before sending to outreach.` },
        { status: 409 }
      )
    }

    // Idempotency — already linked.
    if (task.outreach_queue_id) {
      const { data: existing } = await supabaseAdmin
        .from('outreach_queue')
        .select('id, subject, body, status')
        .eq('id', task.outreach_queue_id as string)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({
          success: true,
          reused: true,
          draft: existing,
        })
      }
      // Linked draft was deleted; fall through and regenerate.
    }

    // Idempotency — a draft already exists for this task but isn't linked on
    // the task row yet (e.g. prior run failed to update). Link and return it.
    const { data: existingTaskDraft } = await supabaseAdmin
      .from('outreach_queue')
      .select('id, subject, body, status')
      .eq('source_task_id', taskId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingTaskDraft?.id) {
      await updateTask(taskId, { outreach_queue_id: existingTaskDraft.id as string })
      return NextResponse.json({
        success: true,
        reused: true,
        draft: existingTaskDraft,
      })
    }

    // Generate a fresh draft.
    const result = await generateOutreachDraftInApp({
      contactId,
      sequenceStep: 1,
      sourceTaskId: taskId,
      force: false,
    })

    if (result.outcome === 'skipped') {
      return NextResponse.json(
        {
          error:
            'A draft with the same task source already exists. Open the outreach queue to review it.',
        },
        { status: 409 }
      )
    }

    if (result.outcome === 'existing') {
      return NextResponse.json(
        {
          error:
            'A draft is already in the queue for this meeting and template. Open it from Email center or the task.',
          queueId: result.queueId,
        },
        { status: 409 }
      )
    }

    await updateTask(taskId, { outreach_queue_id: result.id })

    return NextResponse.json({
      success: true,
      reused: false,
      draft: {
        id: result.id,
        subject: result.subject,
        body: result.body,
        status: 'draft',
      },
    })
  } catch (error) {
    console.error('[send-to-outreach] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong while generating the outreach draft. Please try again.' },
      { status: 500 }
    )
  }
}
