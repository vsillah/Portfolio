import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/proposals/[id]/dashboard-link
 * Returns the client dashboard URL for a paid proposal.
 * No auth required — proposal ID is not guessable and this only returns a URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params

  if (!proposalId) {
    return NextResponse.json({ error: 'Missing proposal ID' }, { status: 400 })
  }

  const { data: project } = await supabaseAdmin
    .from('client_projects')
    .select('id')
    .eq('proposal_id', proposalId)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ dashboard_url: null })
  }

  const { data: access } = await supabaseAdmin
    .from('client_dashboard_access')
    .select('access_token')
    .eq('client_project_id', project.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!access?.access_token) {
    return NextResponse.json({ dashboard_url: null })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://amadutown.com'
  return NextResponse.json({
    dashboard_url: `${siteUrl}/client/dashboard/${access.access_token}`,
  })
}
