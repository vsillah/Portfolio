import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSourceProtocolBearer } from '@/lib/source-protocol-auth'
import { buildMonthlyPayoutInsertRows } from '@/lib/source-respecting-llm-persistence'
import type { MonthlyPayoutSettlement } from '@/lib/source-respecting-llm-protocol'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const unauthorized = requireSourceProtocolBearer(request.headers.get('authorization'))
  if (unauthorized) return unauthorized

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const settlement = body.settlement as MonthlyPayoutSettlement | undefined

    if (!settlement?.period || !Array.isArray(settlement.payouts)) {
      return NextResponse.json({ error: 'settlement is required' }, { status: 400 })
    }

    const rows = buildMonthlyPayoutInsertRows(settlement)

    if (rows.monthlyCreatorPayouts.length === 0) {
      return NextResponse.json({ ok: true, period: settlement.period, payouts: 0 })
    }

    const { error } = await supabaseAdmin
      .from('monthly_creator_payouts')
      .upsert(rows.monthlyCreatorPayouts, {
        onConflict: 'creator_external_id,settlement_period',
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      period: settlement.period,
      payouts: rows.monthlyCreatorPayouts.length,
      totalAccruedUsd: settlement.totalAccruedUsd,
      totalPayableUsd: settlement.totalPayableUsd,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to persist monthly payouts' },
      { status: 500 }
    )
  }
}
