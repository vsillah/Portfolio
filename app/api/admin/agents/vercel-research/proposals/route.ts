import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  createVercelResearchApproval,
  listPendingVercelResearchApprovals,
} from '@/lib/vercel-deployment-research-approvals'
import type { VercelResearchProposal } from '@/lib/vercel-deployment-research'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const approvals = await listPendingVercelResearchApprovals()
    return NextResponse.json({ ok: true, approvals })
  } catch (error) {
    console.error('[vercel-research-proposals] list failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list Vercel AutoResearch proposals' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as {
    proposal?: VercelResearchProposal
  }
  if (!body.proposal?.id || !body.proposal.title || !body.proposal.approvalQuestion) {
    return NextResponse.json({ error: 'proposal id, title, and approvalQuestion are required' }, { status: 400 })
  }

  try {
    const result = await createVercelResearchApproval({
      proposal: body.proposal,
      createdByUserId: auth.user.id,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[vercel-research-proposals] create failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Vercel AutoResearch proposal' },
      { status: 500 },
    )
  }
}
