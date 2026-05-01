import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildProposalRoadmapSnapshot } from '@/lib/client-ai-ops-roadmap'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as {
    stackSignals?: string[]
    implementationRequirements?: Record<string, unknown>
  }

  const { data: proposal, error: proposalError } = await supabaseAdmin
    .from('proposals')
    .select('id, client_name, client_company, sales_session_id')
    .eq('id', id)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const snapshot = buildProposalRoadmapSnapshot({
    clientName: proposal.client_name,
    clientCompany: proposal.client_company,
    proposalId: proposal.id,
    stackSignals: body.stackSignals ?? [],
    implementationRequirements: body.implementationRequirements ?? null,
  })

  const { error: updateError } = await supabaseAdmin
    .from('proposals')
    .update({ implementation_roadmap_snapshot: snapshot })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to attach roadmap snapshot' }, { status: 500 })
  }

  return NextResponse.json({ snapshot })
}
