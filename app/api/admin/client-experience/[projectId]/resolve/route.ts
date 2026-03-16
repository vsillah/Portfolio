import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { projectId } = params

    const { data: project, error: projectError } = await supabaseAdmin
      .from('client_projects')
      .select('id, project_name, client_name, client_email, project_status, created_at')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Proposals link to projects via client_email (no direct FK)
    let proposal = null
    if (project.client_email) {
      const { data } = await supabaseAdmin
        .from('proposals')
        .select(`
          id,
          access_code,
          status,
          client_name,
          client_email,
          client_company,
          bundle_name,
          line_items,
          subtotal,
          discount_amount,
          discount_description,
          total_amount,
          terms_text,
          valid_until,
          pdf_url,
          contract_pdf_url,
          signed_at,
          signed_by_name,
          contract_signed_at,
          contract_signed_by_name,
          accepted_at,
          paid_at,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          created_at
        `)
        .eq('client_email', project.client_email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      proposal = data || null
    }

    const { data: dashboardAccess } = await supabaseAdmin
      .from('client_dashboard_access')
      .select('id, access_token, is_active, last_accessed_at, created_at')
      .eq('client_project_id', projectId)
      .eq('is_active', true)
      .limit(1)
      .single()

    return NextResponse.json({
      project: {
        id: project.id,
        project_name: project.project_name,
        client_name: project.client_name,
        client_email: project.client_email,
        project_status: project.project_status,
        created_at: project.created_at,
      },
      proposal,
      dashboard: dashboardAccess
        ? {
            access_token: dashboardAccess.access_token,
            is_active: dashboardAccess.is_active,
            last_accessed_at: dashboardAccess.last_accessed_at,
            created_at: dashboardAccess.created_at,
          }
        : null,
    })
  } catch (err) {
    console.error('Client experience resolve error:', err)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
