import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { classifyMarketIntel } from '@/lib/market-intel-classifier'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/classify
 *
 * Batch-classify unprocessed market intelligence into pain point evidence.
 * Runs the keyword classifier on all unprocessed rows (up to `limit`).
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const limit = Math.min(Number(body.limit) || 500, 1000)

  try {
    const result = await classifyMarketIntel(limit)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Batch classification failed:', error)
    return NextResponse.json(
      { error: 'Classification failed', details: error.message },
      { status: 500 }
    )
  }
}
