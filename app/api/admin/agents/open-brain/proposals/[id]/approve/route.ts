import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { reviewOpenBrainProposal } from '@/lib/open-brain'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  try {
    const proposal = await reviewOpenBrainProposal(
      decodeURIComponent(params.id),
      'approved',
      typeof body.reason === 'string' ? body.reason : 'Approved from Portfolio Admin.',
      auth.user?.id || 'portfolio-admin',
    )
    return NextResponse.json({ proposal })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Proposal approval failed' }, { status: 404 })
  }
}
