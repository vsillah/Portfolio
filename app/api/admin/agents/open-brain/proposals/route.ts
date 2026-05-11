import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { createOpenBrainProposal, validateMemoryProposal } from '@/lib/open-brain'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const errors = validateMemoryProposal(body)
  if (errors.length > 0) return NextResponse.json({ error: errors.join(' ') }, { status: 400 })

  const proposal = await createOpenBrainProposal({
    ...body,
    createdBy: auth.user?.id || 'portfolio-admin',
  })
  return NextResponse.json({ proposal }, { status: 201 })
}
