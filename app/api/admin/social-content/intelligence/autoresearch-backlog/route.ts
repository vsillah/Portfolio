import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildAutoResearchBacklogReadOnlyResponse } from '@/lib/cross-channel-autoresearch-backlog'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  return NextResponse.json(buildAutoResearchBacklogReadOnlyResponse())
}
