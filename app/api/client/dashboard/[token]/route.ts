import { NextRequest, NextResponse } from 'next/server'
import { getDashboardByToken } from '@/lib/client-dashboard'

/**
 * GET /api/client/dashboard/[token]
 * Returns full dashboard payload for a client.
 * No authentication required — token-based access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid dashboard link' }, { status: 400 })
  }

  const { data, stage, error } = await getDashboardByToken(token)

  if (error || !data) {
    return NextResponse.json(
      { error: error || 'Dashboard not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ data, stage })
}
