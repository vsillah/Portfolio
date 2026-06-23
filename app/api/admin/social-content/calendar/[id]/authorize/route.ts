import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { authorizeCalendarDraftHandoff } from '@/lib/social-content-calendar-handoff'
import { CALENDAR_SIDE_EFFECTS } from '@/lib/social-content-calendar'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const result = await authorizeCalendarDraftHandoff(params.id, auth)

    return NextResponse.json({
      ok: true,
      item: result.calendarItem,
      handoff: {
        kind: result.handoffKind,
        work_item_id: result.handoffWorkItemId,
        social_content_id: result.socialContentId,
      },
      side_effects: {
        ...CALENDAR_SIDE_EFFECTS,
        internal_draft_handoff_created: true,
        social_content_draft_created: Boolean(result.socialContentId),
      },
    })
  } catch (error) {
    console.error('[social-content-calendar] authorize handoff failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to authorize calendar draft handoff' },
      { status: 500 },
    )
  }
}
