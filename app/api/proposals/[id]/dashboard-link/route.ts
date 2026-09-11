import { milestoneAccess } from '@/lib/proposal-milestones'
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

  const {data: accessProposal,error: accessError}=await supabaseAdmin.from('proposals').select('payment_schedule,access_code,milestone_settlement,signed_at,contract_signed_at').eq('id',proposalId).single();
  if(accessError || !accessProposal || !milestoneAccess(request,accessProposal)) return NextResponse.json({error:'Proposal not found'},{status:404});

  if (accessProposal.milestone_settlement === 'manual_invoice') {
    if (!accessProposal.signed_at || !accessProposal.contract_signed_at) return NextResponse.json({ dashboard_url: null });
    const { data: plan, error } = await supabaseAdmin.from('installment_plans').select('installments_paid').eq('proposal_id', proposalId).eq('billing_kind', 'milestones').maybeSingle();
    if (error) return NextResponse.json({ error: 'Payment status unavailable' }, { status: 503 });
    if (!plan || plan.installments_paid < 1) return NextResponse.json({ dashboard_url: null });
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
