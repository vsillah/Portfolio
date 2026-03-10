import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/cost-revenue/summary
 *
 * Phase 1: Returns zeros for revenue; aggregates cost_events only.
 * Phase 4 will add orders, proposals paid, and subscription revenue.
 *
 * Query params: from (ISO date), to (ISO date). Defaults to MTD if omitted.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { searchParams } = new URL(request.url)
  let from = searchParams.get('from')
  let to = searchParams.get('to')

  if (!from || !to) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    from = from || startOfMonth.toISOString().split('T')[0]
    to = to || now.toISOString().split('T')[0]
  }

  const fromDate = `${from}T00:00:00.000Z`
  const toDate = `${to}T23:59:59.999Z`

  try {
    // Revenue: orders (completed) in range
    const { data: orderRows, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('final_amount')
      .eq('status', 'completed')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
    }

    let ordersRevenue = 0
    for (const row of orderRows || []) {
      ordersRevenue += Number(row.final_amount) || 0
    }

    // Proposals paid (without order) — e.g. custom proposals paid via Stripe link
    const { data: proposalRows } = await supabaseAdmin
      .from('proposals')
      .select('total_amount')
      .not('paid_at', 'is', null)
      .is('order_id', null)
      .gte('paid_at', fromDate)
      .lte('paid_at', toDate)

    let proposalsRevenue = 0
    for (const row of proposalRows || []) {
      proposalsRevenue += Number(row.total_amount) || 0
    }

    const totalRevenue = ordersRevenue + proposalsRevenue

    // Cost: cost_events in range
    const { data: costRows, error } = await supabaseAdmin
      .from('cost_events')
      .select('source, amount')
      .gte('occurred_at', fromDate)
      .lte('occurred_at', toDate)

    if (error) {
      console.error('Error fetching cost_events:', error)
      return NextResponse.json({ error: 'Failed to fetch cost summary' }, { status: 500 })
    }

    const costBySource: Record<string, number> = {}
    let totalCost = 0

    for (const row of costRows || []) {
      const amt = Number(row.amount) || 0
      totalCost += amt
      const src = row.source || 'other'
      costBySource[src] = (costBySource[src] || 0) + amt
    }

    const costBySourceList = Object.entries(costBySource).map(([source, amount]) => ({
      source,
      amount: Math.round(amount * 100) / 100,
    }))

    const grossProfit = totalRevenue - totalCost
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : null
    const profitCostRatio = totalCost > 0 && grossProfit >= 0 ? grossProfit / totalCost : null

    return NextResponse.json({
      from,
      to,
      revenue: {
        total: Math.round(totalRevenue * 100) / 100,
        orders: Math.round(ordersRevenue * 100) / 100,
        subscriptions: 0,
        proposals: Math.round(proposalsRevenue * 100) / 100,
      },
      cost: {
        total: Math.round(totalCost * 100) / 100,
        bySource: costBySourceList,
      },
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMarginPercent: grossMarginPercent != null ? Math.round(grossMarginPercent * 10) / 10 : null,
      profitCostRatio: profitCostRatio != null ? Math.round(profitCostRatio * 10) / 10 : null,
    })
  } catch (err) {
    console.error('Error in GET /api/admin/cost-revenue/summary:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
