import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  createOnboardingPlanForProject,
  type ProposalContext,
  type ClientProjectContext,
} from '@/lib/onboarding-templates'
import { generateOnboardingPlanPDF, type OnboardingPlanPDFData } from '@/lib/onboarding-pdf'
import { generateClientDashboard } from '@/lib/client-dashboard'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client-projects
 * 
 * Creates a client_project record from a paid proposal, then auto-generates
 * the onboarding plan, PDF, and fires the n8n webhook for email delivery.
 * 
 * Called from the payment webhook or manually by admin.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { proposal_id, override_start_date } = body

    if (!proposal_id) {
      return NextResponse.json(
        { error: 'proposal_id is required' },
        { status: 400 }
      )
    }

    // 1. Fetch the proposal with all context
    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', proposal_id)
      .single()

    if (proposalError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      )
    }

    // Check if a client_project already exists for this proposal
    const { data: existingProject } = await supabaseAdmin
      .from('client_projects')
      .select('id, onboarding_plan_id')
      .eq('proposal_id', proposal_id)
      .single()

    if (existingProject) {
      return NextResponse.json(
        {
          error: 'Client project already exists for this proposal',
          client_project_id: existingProject.id,
          onboarding_plan_id: existingProject.onboarding_plan_id,
        },
        { status: 409 }
      )
    }

    // 2. Generate client_id
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const { count } = await supabaseAdmin
      .from('client_projects')
      .select('*', { count: 'exact', head: true })

    const clientId = `cli_${dateStr}_${(count || 0) + 1}`

    // 3. Calculate dates
    const startDate = override_start_date
      ? new Date(override_start_date)
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 1 week from now

    // 4. Create client_project record
    const { data: project, error: projectError } = await supabaseAdmin
      .from('client_projects')
      .insert({
        client_id: clientId,
        client_name: proposal.client_name,
        client_email: proposal.client_email,
        client_company: proposal.client_company || null,
        proposal_id: proposal.id,
        sales_session_id: proposal.sales_session_id || null,
        project_status: 'payment_received',
        current_phase: 0,
        product_purchased: proposal.bundle_name,
        payment_amount: proposal.total_amount,
        project_start_date: startDate.toISOString(),
        stripe_session_id: proposal.checkout_session_id || null,
        contract_pdf_url: proposal.contract_pdf_url ?? null,
      })
      .select()
      .single()

    if (projectError || !project) {
      console.error('Error creating client project:', projectError)
      return NextResponse.json(
        { error: 'Failed to create client project' },
        { status: 500 }
      )
    }

    // Link the sales session to this client project (lifecycle: lead → session → client)
    let diagnosticAuditId: string | number | null = null
    if (proposal.sales_session_id) {
      await supabaseAdmin
        .from('sales_sessions')
        .update({ client_project_id: project.id })
        .eq('id', proposal.sales_session_id)

      const { data: session } = await supabaseAdmin
        .from('sales_sessions')
        .select('diagnostic_audit_id')
        .eq('id', proposal.sales_session_id)
        .single()
      diagnosticAuditId = session?.diagnostic_audit_id ?? null
    }

    // Backfill contact_submission_id from diagnostic (so dashboard can load assessment)
    if (diagnosticAuditId != null) {
      const { data: audit } = await supabaseAdmin
        .from('diagnostic_audits')
        .select('contact_submission_id')
        .eq('id', diagnosticAuditId)
        .single()
      if (audit?.contact_submission_id != null) {
        await supabaseAdmin
          .from('client_projects')
          .update({ contact_submission_id: audit.contact_submission_id })
          .eq('id', project.id)
      }

      // Promote lead dashboard to client: same token now serves full dashboard
      await supabaseAdmin
        .from('client_dashboard_access')
        .update({ client_project_id: project.id })
        .eq('diagnostic_audit_id', diagnosticAuditId)
        .is('client_project_id', null)
    }

    // Cascade client_project_id onto pre-sale meeting_records and their tasks.
    // Resolve the lead's contact_submission_id from the project (may have been
    // set above via diagnostic audit, or may already exist on the project row).
    const { data: freshProject } = await supabaseAdmin
      .from('client_projects')
      .select('contact_submission_id')
      .eq('id', project.id)
      .single()

    const leadId = freshProject?.contact_submission_id
    if (leadId) {
      const { data: linkedMeetings } = await supabaseAdmin
        .from('meeting_records')
        .update({ client_project_id: project.id })
        .eq('contact_submission_id', leadId)
        .is('client_project_id', null)
        .select('id')

      if (linkedMeetings && linkedMeetings.length > 0) {
        const meetingIds = linkedMeetings.map((m: { id: string }) => m.id)
        await supabaseAdmin
          .from('meeting_action_tasks')
          .update({ client_project_id: project.id })
          .in('meeting_record_id', meetingIds)
          .is('client_project_id', null)
      }
    }

    // 5. Build proposal context for template resolution
    const proposalContext: ProposalContext = {
      id: proposal.id,
      client_name: proposal.client_name,
      client_email: proposal.client_email,
      client_company: proposal.client_company,
      bundle_name: proposal.bundle_name,
      line_items: proposal.line_items || [],
      total_amount: proposal.total_amount,
      sales_session_id: proposal.sales_session_id,
    }

    const projectContext: ClientProjectContext = {
      id: project.id,
      client_name: project.client_name,
      client_email: project.client_email,
      client_company: project.client_company,
      project_start_date: project.project_start_date,
      product_purchased: project.product_purchased,
    }

    // 6. Generate the onboarding plan
    const planResult = await createOnboardingPlanForProject(projectContext, proposalContext)

    if (!planResult) {
      console.warn('Could not generate onboarding plan (no matching template). Project created without plan.')
      return NextResponse.json({
        client_project_id: project.id,
        client_id: clientId,
        onboarding_plan_id: null,
        message: 'Project created but no matching onboarding template found.',
      })
    }

    // 7. Fetch the full plan for PDF generation
    const { data: plan } = await supabaseAdmin
      .from('onboarding_plans')
      .select('*')
      .eq('id', planResult.planId)
      .single()

    let pdfUrl: string | null = null

    if (plan) {
      // 8. Generate PDF
      try {
        const pdfData: OnboardingPlanPDFData = {
          id: plan.id,
          client_name: project.client_name,
          client_email: project.client_email,
          client_company: project.client_company,
          project_name: proposal.bundle_name,
          template_name: planResult.templateName,
          created_at: plan.created_at,
          project_start_date: project.project_start_date,
          estimated_end_date: project.estimated_end_date,
          setup_requirements: plan.setup_requirements,
          milestones: plan.milestones,
          communication_plan: plan.communication_plan,
          win_conditions: plan.win_conditions,
          warranty: plan.warranty,
          artifacts_handoff: plan.artifacts_handoff,
          company_name: 'ATAS',
        }

        const pdfBuffer = await generateOnboardingPlanPDF(pdfData)

        // Upload to Supabase Storage
        const storagePath = `onboarding-plans/${plan.id}.pdf`
        const { error: uploadError } = await supabaseAdmin.storage
          .from('documents')
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          })

        if (uploadError) {
          console.error('Error uploading PDF:', uploadError)
        } else {
          const { data: urlData } = supabaseAdmin.storage
            .from('documents')
            .getPublicUrl(storagePath)
          pdfUrl = urlData.publicUrl

          // Update plan with PDF URL
          await supabaseAdmin
            .from('onboarding_plans')
            .update({ pdf_url: pdfUrl })
            .eq('id', plan.id)
        }
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError)
        // Don't fail the whole request for a PDF error
      }

      // 9. Onboarding email is NOT sent automatically.
      // Admin must approve via POST /api/admin/client-projects/[id]/approve-onboarding
    }

    // 10. Update estimated_end_date on client_project if we have template duration
    if (plan?.template_id) {
      const { data: template } = await supabaseAdmin
        .from('onboarding_plan_templates')
        .select('estimated_duration_weeks')
        .eq('id', plan.template_id)
        .single()

      if (template?.estimated_duration_weeks) {
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + template.estimated_duration_weeks * 7)
        await supabaseAdmin
          .from('client_projects')
          .update({ estimated_end_date: endDate.toISOString() })
          .eq('id', project.id)
      }
    }

    // 11. Auto-generate client dashboard (if one doesn't already exist from lead promotion)
    let dashboardUrl: string | null = null
    try {
      const { data: existingAccess } = await supabaseAdmin
        .from('client_dashboard_access')
        .select('access_token')
        .eq('client_project_id', project.id)
        .maybeSingle()

      let dashboardToken = existingAccess?.access_token
      if (!dashboardToken) {
        const dashResult = await generateClientDashboard(project.id)
        dashboardToken = dashResult.accessToken
      }

      if (dashboardToken) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://amadutown.com'
        dashboardUrl = `${siteUrl}/client/dashboard/${dashboardToken}`
      }
    } catch (dashError) {
      console.error('Error auto-generating client dashboard:', dashError)
    }

    return NextResponse.json({
      client_project_id: project.id,
      client_id: clientId,
      onboarding_plan_id: planResult.planId,
      pdf_url: pdfUrl,
      template_name: planResult.templateName,
      dashboard_url: dashboardUrl,
      message: 'Client project and onboarding plan created successfully.',
    })
  } catch (error: any) {
    console.error('Error in POST /api/client-projects:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
