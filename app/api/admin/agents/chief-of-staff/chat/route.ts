import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  normalizeChiefOfStaffHistory,
  runChiefOfStaffChat,
  type ChiefOfStaffChatMessage,
} from '@/lib/chief-of-staff-chat'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/agents/chief-of-staff/chat
 *
 * Admin-only conversational entrypoint for the Chief of Staff Agent. V1 is
 * read-only: it summarizes operating context and records an observable
 * agent_run, but it does not mutate production workflow data.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { message?: unknown; history?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  const history = Array.isArray(body.history)
    ? normalizeChiefOfStaffHistory(body.history as ChiefOfStaffChatMessage[])
    : []

  try {
    const result = await runChiefOfStaffChat({
      message,
      history,
      userId: auth.user.id,
    })

    return NextResponse.json({
      ok: true,
      run_id: result.runId,
      reply: result.reply,
      suggested_actions: result.suggestedActions,
      model: result.model,
    })
  } catch (error) {
    console.error('[chief-of-staff-chat] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chief of Staff chat failed' },
      { status: 500 },
    )
  }
}
