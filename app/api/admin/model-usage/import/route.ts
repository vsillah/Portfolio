import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildModelUsageImportPlan, importModelUsagePacket, type ModelUsageImportPacket } from '@/lib/model-usage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as ModelUsageImportPacket

  try {
    if (body.dryRun === true) {
      const plan = buildModelUsageImportPlan(body)
      return NextResponse.json({
        ok: true,
        dryRun: true,
        eventCount: plan.eventRows.length,
        subscriptionAllocationCount: plan.subscriptionAllocationRows.length,
        warnings: plan.warnings,
      })
    }

    const result = await importModelUsagePacket(body)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import model usage packet'
    console.error('[model-usage-import] import failed:', error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
