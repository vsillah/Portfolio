import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { saveDiagnosticAudit } from '@/lib/diagnostic'

export const dynamic = 'force-dynamic'

function generateAuditSessionId(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).substring(2, 12)
  return `audit_${t}_${r}`
}

/**
 * POST /api/tools/audit/start
 * Creates a chat_sessions row and a diagnostic_audits row for the standalone audit tool.
 * Returns { sessionId, auditId } for the client to use in subsequent update calls.
 */
export async function POST() {
  try {
    const sessionId = generateAuditSessionId()

    const { error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        session_id: sessionId,
        visitor_email: null,
        visitor_name: null,
      })

    if (sessionError) {
      const err = sessionError as { message?: string }
      console.error('Audit start: chat_sessions insert failed', sessionError)
      return NextResponse.json(
        { error: err?.message || 'Could not start audit session' },
        { status: 500 }
      )
    }

    const result = await saveDiagnosticAudit(sessionId, {
      status: 'in_progress',
      auditType: 'standalone',
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || 'Could not create audit' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sessionId,
      auditId: result.id,
    })
  } catch (e) {
    console.error('Audit start error', e)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
