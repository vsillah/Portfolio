import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  fireOnboardingWebhook,
  buildMilestonesSummary,
  type Milestone,
} from '@/lib/onboarding-templates'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/client-projects/[id]/approve-onboarding
 *
 * Admin-only endpoint that fires the onboarding webhook and marks the email as sent.
 * Onboarding email is NOT sent automatically on project creation; admin must approve.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = await params

    // Fetch client_project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('client_projects')
      .select('*')
      .eq('id', id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Client project not found' },
        { status: 404 }
      )
    }

    // If already sent, return early
    if (project.onboarding_email_sent_at) {
      return NextResponse.json({
        already_sent: true,
        sent_at: project.onboarding_email_sent_at,
      })
    }

    // Fetch onboarding_plan by client_project_id
    const { data: plan, error: planError } = await supabaseAdmin
      .from('onboarding_plans')
      .select('*')
      .eq('client_project_id', id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'No onboarding plan found for this project' },
        { status: 400 }
      )
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // Look up client dashboard URL for inclusion in onboarding email
    const { data: dashAccess } = await supabaseAdmin
      .from('client_dashboard_access')
      .select('access_token')
      .eq('client_project_id', id)
      .eq('is_active', true)
      .maybeSingle()

    const dashboardUrl = dashAccess?.access_token
      ? `${baseUrl}/client/dashboard/${dashAccess.access_token}`
      : undefined

    await fireOnboardingWebhook({
      onboarding_plan_id: plan.id,
      onboarding_plan_url: `${baseUrl}/onboarding/${plan.id}`,
      pdf_url: plan.pdf_url || '',
      client_name: project.client_name,
      client_email: project.client_email,
      client_company: null,
      project_name: project.project_name || '',
      milestones_summary: buildMilestonesSummary((plan.milestones as Milestone[]) || []),
      kickoff_date: project.project_start_date || null,
      template_name: plan.template_name || '',
      trigger_onboarding_call: true,
      dashboard_url: dashboardUrl,
    })

    const sentAt = new Date().toISOString()
    await supabaseAdmin
      .from('client_projects')
      .update({ onboarding_email_sent_at: sentAt })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      sent_at: sentAt,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/client-projects/[id]/approve-onboarding:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
