import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { rejectCalendarDraftHandoff } from '@/lib/social-content-calendar-handoff'
import { CALENDAR_SIDE_EFFECTS } from '@/lib/social-content-calendar'

export const dynamic = 'force-dynamic'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const decisionNote = cleanText(body.decision_note)
    if (!decisionNote) {
      return NextResponse.json(
        { error: 'Decision note is required when rejecting a calendar item' },
        { status: 400 },
      )
    }

    const result = await rejectCalendarDraftHandoff({
      id: params.id,
      decisionNote,
      auth,
    })

    return NextResponse.json({
      ok: true,
      item: result.calendarItem,
      revision_work_item_id: result.revisionWorkItemId,
      side_effects: {
        ...CALENDAR_SIDE_EFFECTS,
        revision_work_item_created: true,
      },
    })
  } catch (error) {
    console.error('[social-content-calendar] reject handoff failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject calendar draft handoff' },
      { status: 500 },
    )
  }
}
