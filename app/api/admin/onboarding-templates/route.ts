import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/onboarding-templates
 * 
 * List all onboarding plan templates for admin management.
 */
export async function GET() {
  try {
    const { data: templates, error } = await supabaseAdmin
      .from('onboarding_plan_templates')
      .select('*')
      .order('content_type')
      .order('service_type')

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    return NextResponse.json({ templates })
  } catch (error: any) {
    console.error('Error in GET /api/admin/onboarding-templates:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/onboarding-templates
 * 
 * Create a new onboarding plan template.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const requiredFields = ['name', 'content_type']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    const { data: template, error } = await supabaseAdmin
      .from('onboarding_plan_templates')
      .insert({
        name: body.name,
        content_type: body.content_type,
        service_type: body.service_type || null,
        offer_role: body.offer_role || null,
        setup_requirements: body.setup_requirements || [],
        milestones_template: body.milestones_template || [],
        communication_plan: body.communication_plan || {},
        win_conditions: body.win_conditions || [],
        warranty: body.warranty || {},
        artifacts_handoff: body.artifacts_handoff || [],
        estimated_duration_weeks: body.estimated_duration_weeks || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ template }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/admin/onboarding-templates:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
