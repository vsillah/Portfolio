import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getOpenBrainSnapshot } from '@/lib/open-brain'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const snapshot = await getOpenBrainSnapshot()
  return NextResponse.json({
    mode: 'preview',
    approvalRequired: true,
    message: 'Compiled wiki overlay preview only. Commit or file writes require a separate approved repo change.',
    pages: snapshot.wikiPages,
  })
}
