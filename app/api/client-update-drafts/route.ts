import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateUpdateDraft, listDrafts } from '@/lib/client-update-drafts'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client-update-drafts
 *
 * List drafts. Query params:
 *   - client_project_id: filter by project
 *   - status: 'draft' | 'sent'
 *
 * Auth: admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const clientProjectId = searchParams.get('client_project_id') || undefined
    const statusParam = searchParams.get('status') || undefined

    // Validate status against allowed values
    const VALID_DRAFT_STATUSES = ['draft', 'sent'] as const
    let status: 'draft' | 'sent' | undefined
    if (statusParam) {
      if (!VALID_DRAFT_STATUSES.includes(statusParam as typeof VALID_DRAFT_STATUSES[number])) {
        return NextResponse.json(
          { error: `Invalid status: ${statusParam}. Allowed: ${VALID_DRAFT_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      status = statusParam as 'draft' | 'sent'
    }

    const drafts = await listDrafts({ clientProjectId, status })

    return NextResponse.json({ drafts })
  } catch (error) {
    console.error('[Client update drafts GET] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/client-update-drafts
 *
 * Generate a draft update email from completed tasks.
 * Body: {
 *   client_project_id: string (required)
 *   meeting_record_id?: string
 *   task_ids?: string[]
 *   custom_note?: string
 * }
 *
 * Auth: admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const { client_project_id, meeting_record_id, task_ids, custom_note } = body

    if (!client_project_id) {
      return NextResponse.json(
        { error: 'client_project_id is required' },
        { status: 400 }
      )
    }

    const userId = !isAuthError(authResult) ? authResult.user.id : undefined

    const draft = await generateUpdateDraft({
      clientProjectId: client_project_id,
      meetingRecordId: meeting_record_id,
      taskIds: task_ids,
      customNote: custom_note,
      userId,
    })

    if (!draft) {
      return NextResponse.json(
        { error: 'No unsent completed tasks found to include in draft' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, draft }, { status: 201 })
  } catch (error) {
    console.error('[Client update drafts POST] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
