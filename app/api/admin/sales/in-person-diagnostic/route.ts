import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sales/in-person-diagnostic
 * Create a new diagnostic audit from an in-person sales conversation.
 * Unlike the chat-based diagnostic, this creates the audit directly
 * with data entered by the sales rep during the call.
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (isAuthError(admin)) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  try {
    const body = await request.json()
    const {
      sales_session_id,
      contact_submission_id,
      diagnostic_data,
      status = 'in_progress',
    } = body

    if (!sales_session_id) {
      return NextResponse.json({ error: 'sales_session_id is required' }, { status: 400 })
    }

    // Create a synthetic session_id for the diagnostic (not tied to a chat session)
    const syntheticSessionId = `in-person-${sales_session_id}-${Date.now()}`
    const auditId = uuidv4()

    const insertData: Record<string, unknown> = {
      id: auditId,
      session_id: syntheticSessionId,
      contact_submission_id: contact_submission_id || null,
      status,
      business_challenges: diagnostic_data?.business_challenges || {},
      tech_stack: diagnostic_data?.tech_stack || {},
      automation_needs: diagnostic_data?.automation_needs || {},
      ai_readiness: diagnostic_data?.ai_readiness || {},
      budget_timeline: diagnostic_data?.budget_timeline || {},
      decision_making: diagnostic_data?.decision_making || {},
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (status === 'completed') {
      insertData.completed_at = new Date().toISOString()
    }

    // Insert the diagnostic audit
    const { error: insertError } = await supabaseAdmin
      .from('diagnostic_audits')
      .insert(insertData)

    if (insertError) {
      console.error('Failed to create in-person diagnostic:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Link the diagnostic to the sales session
    const { error: linkError } = await supabaseAdmin
      .from('sales_sessions')
      .update({
        diagnostic_audit_id: auditId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sales_session_id)

    if (linkError) {
      console.error('Failed to link diagnostic to session:', linkError)
      // Non-fatal: the audit was created, just not linked
    }

    return NextResponse.json({
      auditId,
      sessionId: syntheticSessionId,
      status,
    })
  } catch (error) {
    console.error('In-person diagnostic API error:', error)
    return NextResponse.json({ error: 'Failed to create diagnostic' }, { status: 500 })
  }
}
