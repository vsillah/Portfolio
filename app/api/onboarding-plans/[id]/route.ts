import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/onboarding-plans/[id]
 * 
 * Public endpoint for clients to view their onboarding plan.
 * Also used by admin to fetch plan details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: plan, error } = await supabaseAdmin
      .from('onboarding_plans')
      .select(`
        *,
        client_projects (
          id, client_name, client_email, client_company,
          project_status, current_phase, product_purchased,
          project_start_date, estimated_end_date, slack_channel
        ),
        onboarding_plan_templates (
          id, name, content_type, service_type, estimated_duration_weeks
        )
      `)
      .eq('id', id)
      .single()

    if (error || !plan) {
      return NextResponse.json(
        { error: 'Onboarding plan not found' },
        { status: 404 }
      )
    }

    // Track first view (mark as acknowledged)
    if (plan.status === 'sent' && !plan.acknowledged_at) {
      await supabaseAdmin
        .from('onboarding_plans')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', id)

      plan.status = 'acknowledged'
      plan.acknowledged_at = new Date().toISOString()
    }

    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('Error in GET /api/onboarding-plans/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/onboarding-plans/[id]
 * 
 * Admin endpoint to customize/override generated plan sections.
 * Sets is_customized = true when sections are modified.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Allowed fields for update
    const allowedFields = [
      'setup_requirements',
      'milestones',
      'communication_plan',
      'win_conditions',
      'warranty',
      'artifacts_handoff',
      'status',
      'admin_notes',
    ]

    const updates: Record<string, any> = {}
    let isCustomized = false

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]

        // Mark as customized if content sections are modified
        if (['setup_requirements', 'milestones', 'communication_plan',
          'win_conditions', 'warranty', 'artifacts_handoff'].includes(field)) {
          isCustomized = true
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    if (isCustomized) {
      updates.is_customized = true
    }

    // Handle status transitions
    if (updates.status === 'sent' && !body.sent_at) {
      updates.sent_at = new Date().toISOString()
    }

    const { data: plan, error } = await supabaseAdmin
      .from('onboarding_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error || !plan) {
      return NextResponse.json(
        { error: 'Failed to update onboarding plan' },
        { status: error ? 500 : 404 }
      )
    }

    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('Error in PATCH /api/onboarding-plans/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
