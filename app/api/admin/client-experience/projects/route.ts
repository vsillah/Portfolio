import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('client_projects')
      .select('id, project_name, client_name, client_email, project_status, created_at')
      .order('created_at', { ascending: false })

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 })
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ projects: [] })
    }

    const projectIds = projects.map((p: { id: string }) => p.id)
    const clientEmails = [...new Set(projects.map((p: { client_email: string }) => p.client_email))]

    const [dashboardResult, proposalResult] = await Promise.all([
      supabaseAdmin
        .from('client_dashboard_access')
        .select('client_project_id')
        .in('client_project_id', projectIds)
        .eq('is_active', true),
      clientEmails.length > 0
        ? supabaseAdmin
            .from('proposals')
            .select('id, client_email, status')
            .in('client_email', clientEmails)
        : Promise.resolve({ data: [], error: null }),
    ])

    const dashboardSet = new Set(
      (dashboardResult.data || []).map((d: { client_project_id: string }) => d.client_project_id)
    )
    // Map client_email → latest proposal status (a client may have multiple proposals)
    const proposalByEmail = new Map<string, { id: string; status: string }>()
    for (const p of (proposalResult.data || []) as { id: string; client_email: string; status: string }[]) {
      proposalByEmail.set(p.client_email, { id: p.id, status: p.status })
    }

    const enriched = projects.map((p: { id: string; project_name: string; client_name: string; client_email: string; project_status: string; created_at: string }) => {
      const proposal = proposalByEmail.get(p.client_email)
      return {
        id: p.id,
        project_name: p.project_name,
        client_name: p.client_name,
        client_email: p.client_email,
        project_status: p.project_status,
        created_at: p.created_at,
        has_proposal: !!proposal,
        proposal_status: proposal?.status ?? null,
        has_dashboard_token: dashboardSet.has(p.id),
      }
    })

    return NextResponse.json({ projects: enriched })
  } catch (err) {
    console.error('Client experience projects error:', err)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
