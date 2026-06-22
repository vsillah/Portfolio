import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { importReadAiFollowUp } from '@/lib/read-ai-follow-up-import'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/read-ai/meetings/:id/follow-up-import
 *
 * Imports a Read.ai meeting into the Portfolio follow-up system:
 * - creates/updates the contact submission
 * - creates/updates the meeting record by read_ai_meeting_id
 * - promotes action items into meeting_action_tasks
 * - optionally stores the drafted follow-up in client_update_drafts
 * - optionally logs Gmail draft metadata in contact_communications/email_messages
 *
 * Auth: admin session or Bearer N8N_INGEST_SECRET.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authorized = await authorizeRequest(request)
  if (!authorized.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contactName = stringField(body.contact_name ?? body.contactName)
  const contactEmail = stringField(body.contact_email ?? body.contactEmail)
  if (!contactName || !contactEmail) {
    return NextResponse.json(
      { error: 'contact_name and contact_email are required' },
      { status: 400 },
    )
  }

  const draftSubject = stringField(body.draft_subject ?? body.draftSubject)
  const draftBody = stringField(body.draft_body ?? body.draftBody)
  if ((draftSubject && !draftBody) || (!draftSubject && draftBody)) {
    return NextResponse.json(
      { error: 'draft_subject and draft_body must be provided together' },
      { status: 400 },
    )
  }

  try {
    const meeting = body.meeting && typeof body.meeting === 'object'
      ? body.meeting as Record<string, unknown>
      : undefined
    const result = await importReadAiFollowUp(
      {
        readAiMeetingId: params.id,
        contactName,
        contactEmail,
        company: stringField(body.company) || null,
        projectName: stringField(body.project_name ?? body.projectName) || null,
        userId: authorized.userId,
        draft: draftSubject && draftBody
          ? {
              subject: draftSubject,
              body: draftBody,
              gmailDraftId: stringField(body.gmail_draft_id ?? body.gmailDraftId) || null,
              gmailThreadId: stringField(body.gmail_thread_id ?? body.gmailThreadId) || null,
              gmailMessageId: stringField(body.gmail_message_id ?? body.gmailMessageId) || null,
              sourceEmailThreadId: stringField(body.source_email_thread_id ?? body.sourceEmailThreadId) || null,
            }
          : null,
      },
      meeting ? { meeting } : undefined,
    )

    return NextResponse.json({ success: true, result }, { status: 201 })
  } catch (error) {
    console.error(`[read-ai/meetings/${params.id}/follow-up-import] Import failed:`, error)
    const message = error instanceof Error ? error.message : 'Failed to import follow-up'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function authorizeRequest(request: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const authResult = await verifyAdmin(request)
  if (!isAuthError(authResult)) {
    return { ok: true, userId: authResult.user.id }
  }

  const expectedSecret = process.env.N8N_INGEST_SECRET
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (expectedSecret && token === expectedSecret) {
    return { ok: true }
  }

  return { ok: false }
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
