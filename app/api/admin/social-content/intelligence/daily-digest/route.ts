import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildSocialContentDailyDigest } from '@/lib/social-content-daily-digest'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { searchParams } = new URL(request.url)
  const lookbackDays = Math.min(Math.max(parseInt(searchParams.get('lookback_days') || '5', 10), 1), 30)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '12', 10), 1), 25)

  try {
    return NextResponse.json({
      digest: await buildSocialContentDailyDigest({ lookbackDays, limit }),
    })
  } catch (error) {
    console.error('[social-content-intelligence] daily digest failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build Content Intelligence digest' },
      { status: 500 },
    )
  }
}
