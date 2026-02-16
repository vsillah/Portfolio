/**
 * Sales Funnel Analytics API
 * GET /api/admin/analytics/funnel?days=30&channel=all
 *
 * Returns funnel stage counts, conversion rates, pipeline value,
 * attention items, loss reasons, and self-benchmark deltas.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  fetchFunnelAnalytics,
  type ChannelFilter,
} from '@/lib/funnel-analytics'

export const dynamic = 'force-dynamic'

const VALID_CHANNELS: ChannelFilter[] = ['all', 'warm', 'cold']

export async function GET(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request)
    if (isAuthError(adminResult)) {
      return NextResponse.json(
        { error: adminResult.error },
        { status: adminResult.status }
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse days (default 30, clamp 1-365)
    const daysParam = searchParams.get('days')
    let days = 30
    if (daysParam) {
      const parsed = parseInt(daysParam, 10)
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 365) {
        days = parsed
      }
    }

    // Parse channel filter (default 'all')
    const channelParam = (searchParams.get('channel') || 'all') as ChannelFilter
    const channel = VALID_CHANNELS.includes(channelParam) ? channelParam : 'all'

    const data = await fetchFunnelAnalytics(days, channel)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Funnel analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
