import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/onboarding-plans/[id]/email-sent
 * 
 * Callback endpoint for n8n to confirm that the onboarding plan
 * email was successfully sent to the client.
 * 
 * Authenticated via X-N8N-Secret header.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify n8n secret
    const n8nSecret = process.env.N8N_WEBHOOK_SECRET
    const providedSecret = request.headers.get('X-N8N-Secret')

    if (n8nSecret && providedSecret !== n8nSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Update the onboarding plan
    const { data: plan, error } = await supabaseAdmin
      .from('onboarding_plans')
      .update({
        email_sent_at: new Date().toISOString(),
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status, email_sent_at')
      .single()

    if (error || !plan) {
      return NextResponse.json(
        { error: 'Onboarding plan not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      plan_id: plan.id,
      email_sent_at: plan.email_sent_at,
    })
  } catch (error: any) {
    console.error('Error in PATCH /api/onboarding-plans/[id]/email-sent:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
