import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  createSupabaseSocialScheduleRecoveryRepository,
  resolveSocialScheduleRecovery,
  SocialScheduleRecoveryError,
  type ScheduleRecoveryAction,
} from '@/lib/social-schedule-recovery'

export const dynamic = 'force-dynamic'

function isAction(value: unknown): value is ScheduleRecoveryAction {
  return value === 'reschedule_reconfirm' || value === 'cancel_scheduled_publication'
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const admin = supabaseAdmin
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (!isAction(body.action)) {
    return NextResponse.json({ error: 'Valid recovery action is required.' }, { status: 400 })
  }
  if (typeof body.work_item_id !== 'string' || !body.work_item_id.trim()) {
    return NextResponse.json({ error: 'Canonical recovery work item is required.' }, { status: 400 })
  }

  try {
    const result = await resolveSocialScheduleRecovery({
      repository: createSupabaseSocialScheduleRecoveryRepository(admin),
      contentId: params.id,
      workItemId: body.work_item_id.trim(),
      action: body.action,
      scheduledFor: typeof body.scheduled_for === 'string' ? body.scheduled_for : null,
      reconfirmPublicationIntent: body.reconfirm_publication_intent === true,
      actorId: auth.user.id,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SocialScheduleRecoveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('[social-schedule-recovery] failed:', error)
    return NextResponse.json({ error: 'Failed to apply schedule recovery decision.' }, { status: 500 })
  }
}
