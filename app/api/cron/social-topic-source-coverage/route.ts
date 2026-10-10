import { NextRequest, NextResponse } from 'next/server'
import { collectLiveSocialTopicCoverage } from '@/lib/social-topic-source-coverage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const coverage = await collectLiveSocialTopicCoverage({ persist: true })
    return NextResponse.json({
      success: true,
      generated_at: coverage.generated_at,
      status: coverage.status,
      receipt_count: coverage.receipts.length,
      product_count: coverage.products.length,
      blockers: coverage.blockers,
      review_only: true,
    })
  } catch (error) {
    console.error('[social-topic-source-coverage-cron] reconciliation failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Source coverage reconciliation failed',
    }, { status: 500 })
  }
}
