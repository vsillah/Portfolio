import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateUpdateDraft, generateLeadFollowup, createDraftDirect, listDrafts } from '@/lib/client-update-drafts'

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
 * Three modes:
 *
 * 1. Generate client update from tasks:
 *    Body: { client_project_id, meeting_record_id?, task_ids?, custom_note? }
 *
 * 2. Generate lead follow-up from tasks:
 *    Body: { contact_submission_id, meeting_record_id?, task_ids?, custom_note? }
 *
 * 3. Create directly (Gmail reply workflow / external systems):
 *    Body: { client_project_id?, contact_submission_id?, subject, body, client_email, client_name, ... }
 *
 * Auth: admin (session) OR n8n (Bearer N8N_INGEST_SECRET).
 */
export async function POST(request: NextRequest) {
  try {
    const authorized = await authorizeRequest(request)
    if (!authorized.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reqBody = await request.json()
    const { client_project_id, contact_submission_id } = reqBody

    if (!client_project_id && !contact_submission_id) {
      return NextResponse.json(
        { error: 'client_project_id or contact_submission_id is required' },
        { status: 400 }
      )
    }

    // Mode 3: Direct draft (subject + body provided)
    if (reqBody.subject && reqBody.body) {
      if (!reqBody.client_email || !reqBody.client_name) {
        return NextResponse.json(
          { error: 'client_email and client_name are required for direct draft creation' },
          { status: 400 }
        )
      }

      const draft = await createDraftDirect({
        clientProjectId: client_project_id || null,
        contactSubmissionId: reqBody.contact_submission_id || null,
        subject: reqBody.subject,
        body: reqBody.body,
        clientEmail: reqBody.client_email,
        clientName: reqBody.client_name,
        meetingRecordId: reqBody.meeting_record_id,
        source: reqBody.source,
        userId: authorized.userId,
      })

      if (!draft) {
        return NextResponse.json(
          { error: 'Failed to create draft' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, draft }, { status: 201 })
    }

    // Mode 2: Lead / contact status report
    if (contact_submission_id && !client_project_id) {
      const draft = await generateLeadFollowup({
        contactSubmissionId: contact_submission_id,
        meetingRecordId: reqBody.meeting_record_id,
        tasks: reqBody.tasks,
        taskIds: reqBody.task_ids,
        customNote: reqBody.custom_note,
        userId: authorized.userId,
      })

      if (!draft) {
        return NextResponse.json(
          { error: 'No tasks found for this contact' },
          { status: 404 }
        )
      }

      return NextResponse.json({ success: true, draft }, { status: 201 })
    }

    // Mode 1: Client project update
    const draft = await generateUpdateDraft({
      clientProjectId: client_project_id,
      meetingRecordId: reqBody.meeting_record_id,
      taskIds: reqBody.task_ids,
      customNote: reqBody.custom_note,
      userId: authorized.userId,
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

/**
 * Authorize via admin session OR N8N_INGEST_SECRET.
 * Returns { ok: boolean, userId?: string }.
 */
async function authorizeRequest(request: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const authResult = await verifyAdmin(request)
  if (!isAuthError(authResult)) {
    return { ok: true, userId: authResult.user.id }
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET

  if (expectedSecret && token === expectedSecret) {
    return { ok: true } // n8n caller — no user ID
  }

  return { ok: false }
}
